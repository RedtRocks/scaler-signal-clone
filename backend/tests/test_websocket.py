from contextlib import contextmanager

import pytest
from starlette.websockets import WebSocketDisconnect

from tests.conftest import direct, group, send


@contextmanager
def connected(client, account):
    """An open socket for `account`, with the `hello` frame already consumed."""
    with client.websocket_connect(f"/ws?token={account.token}") as ws:
        assert ws.receive_json() == {"type": "hello", "data": {"user_id": account.id}}
        yield ws


def next_of_type(ws, event_type):
    """Skip unrelated frames (e.g. presence) until one of `event_type` arrives."""
    while True:
        frame = ws.receive_json()
        if frame["type"] == event_type:
            return frame["data"]


def test_invalid_token_closes_with_4401(client):
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect("/ws?token=bad") as ws:
            ws.receive_json()
    assert closed.value.code == 4401


def test_ping_pong(client, signup):
    aarav = signup("Aarav")
    with connected(client, aarav) as ws:
        ws.send_json({"type": "ping", "data": {}})
        assert ws.receive_json() == {"type": "pong", "data": {}}


def test_malformed_frames_are_ignored(client, signup):
    aarav = signup("Aarav")
    with connected(client, aarav) as ws:
        ws.send_text("not json")
        ws.send_json({"type": "typing", "data": {"conversation_id": "x"}})
        ws.send_json({"type": "ping", "data": {}})
        assert ws.receive_json()["type"] == "pong"


def test_rest_send_pushes_message_new_to_members(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    with connected(client, maya) as maya_ws, connected(client, aarav) as aarav_ws:
        sent = send(client, aarav, conversation["id"], "hey Maya")

        received = next_of_type(maya_ws, "message.new")
        assert received["id"] == sent["id"]
        assert received["body"] == "hey Maya"
        assert received["status"] is None

        own_copy = next_of_type(aarav_ws, "message.new")  # the sender's other tabs
        assert own_copy["status"] == "sent"


def test_delivered_ack_pushes_receipt_to_sender(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    with connected(client, aarav) as aarav_ws, connected(client, maya) as maya_ws:
        sent = send(client, aarav, conversation["id"], "did you get this?")
        next_of_type(maya_ws, "message.new")
        maya_ws.send_json({"type": "delivered", "data": {"message_ids": [sent["id"]]}})

        receipt = next_of_type(aarav_ws, "receipt")
        assert receipt == {
            "conversation_id": conversation["id"],
            "message_ids": [sent["id"]],
            "status": "delivered",
        }

        client.post(
            f"/api/conversations/{conversation['id']}/read",
            json={"up_to_message_id": sent["id"]},
            headers=maya.headers,
        )
        assert next_of_type(aarav_ws, "receipt")["status"] == "read"
        # Maya's own tabs are told to clear the unread badge.
        assert next_of_type(maya_ws, "read") == {
            "conversation_id": conversation["id"],
            "user_id": maya.id,
            "up_to_message_id": sent["id"],
        }


def test_typing_is_relayed_to_other_members(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    with connected(client, maya) as maya_ws, connected(client, aarav) as aarav_ws:
        aarav_ws.send_json(
            {"type": "typing", "data": {"conversation_id": conversation["id"], "is_typing": True}}
        )
        assert next_of_type(maya_ws, "typing") == {
            "conversation_id": conversation["id"],
            "user_id": aarav.id,
            "is_typing": True,
        }


def test_presence_online_and_last_seen(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    direct(client, aarav, maya)
    with connected(client, aarav) as aarav_ws:
        with connected(client, maya):
            online = next_of_type(aarav_ws, "presence")
            assert online == {"user_id": maya.id, "online": True, "last_seen_at": None}
            lookup = client.get(
                "/api/users/lookup", params={"phone": maya.phone}, headers=aarav.headers
            )
            assert lookup.json()["online"] is True

        offline = next_of_type(aarav_ws, "presence")
        assert offline["online"] is False
        assert offline["last_seen_at"].endswith("Z")


def test_group_changes_push_conversation_updated_per_viewer(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    with connected(client, maya) as maya_ws, connected(client, kai) as kai_ws:
        g = group(client, aarav, "Climbers", maya, kai)
        update = next_of_type(maya_ws, "conversation.updated")
        assert update["id"] == g["id"] and update["my_role"] == "member"
        assert next_of_type(maya_ws, "message.new")["system_event"] == {"type": "group_created"}

        assert next_of_type(kai_ws, "conversation.updated")["left"] is False

        client.delete(f"/api/conversations/{g['id']}/members/{kai.id}", headers=aarav.headers)
        assert next_of_type(kai_ws, "conversation.updated")["left"] is True
        assert next_of_type(kai_ws, "conversation.removed") == {"conversation_id": g["id"]}
