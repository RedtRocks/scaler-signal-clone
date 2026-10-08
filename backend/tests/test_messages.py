from datetime import timedelta

from app.db import utcnow
from app.services.messages import expire_due_messages
from tests.conftest import direct, group, send, summary


def test_send_is_idempotent_on_client_id(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    url = f"/api/conversations/{conversation['id']}/messages"

    first = client.post(url, json={"body": "hi", "client_id": "abc"}, headers=aarav.headers)
    retry = client.post(url, json={"body": "hi", "client_id": "abc"}, headers=aarav.headers)
    assert first.status_code == 201 and retry.status_code == 200
    assert first.json()["id"] == retry.json()["id"]
    assert first.json()["client_id"] == "abc"
    assert len(client.get(url, headers=aarav.headers).json()) == 1


def test_empty_body_is_rejected(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"body": "   ", "client_id": "x"},
        headers=aarav.headers,
    )
    assert response.status_code == 422


def test_status_goes_sent_delivered_read(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    url = f"/api/conversations/{conversation['id']}"

    message = send(client, aarav, conversation["id"], "hello")
    assert message["status"] == "sent"

    # Maya fetching history counts as delivery.
    maya_copy = client.get(f"{url}/messages", headers=maya.headers).json()[0]
    assert maya_copy["status"] is None  # status is only on my own messages
    assert client.get(f"{url}/messages", headers=aarav.headers).json()[0]["status"] == "delivered"

    client.post(f"{url}/read", json={"up_to_message_id": message["id"]}, headers=maya.headers)
    assert client.get(f"{url}/messages", headers=aarav.headers).json()[0]["status"] == "read"


def test_group_status_is_the_weakest_recipient(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    g = group(client, aarav, "Climbers", maya, kai)
    url = f"/api/conversations/{g['id']}"
    message = send(client, aarav, g["id"], "who's in?")

    client.post(f"{url}/read", json={"up_to_message_id": message["id"]}, headers=maya.headers)
    assert client.get(f"{url}/messages", headers=aarav.headers).json()[0]["status"] == "sent"

    client.get(f"{url}/messages", headers=kai.headers)  # Kai's device receives it
    assert client.get(f"{url}/messages", headers=aarav.headers).json()[0]["status"] == "delivered"

    client.post(f"{url}/read", json={"up_to_message_id": message["id"]}, headers=kai.headers)
    assert client.get(f"{url}/messages", headers=aarav.headers).json()[0]["status"] == "read"


def test_unread_count_and_read_pointer(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    url = f"/api/conversations/{conversation['id']}"
    first = send(client, maya, conversation["id"], "one")
    send(client, maya, conversation["id"], "two")
    third = send(client, maya, conversation["id"], "three")
    send(client, aarav, conversation["id"], "my own message is never unread")

    assert summary(client, aarav, conversation["id"])["unread_count"] == 3
    assert summary(client, maya, conversation["id"])["unread_count"] == 1

    client.post(f"{url}/read", json={"up_to_message_id": first["id"]}, headers=aarav.headers)
    assert summary(client, aarav, conversation["id"])["unread_count"] == 2

    client.post(f"{url}/read", json={"up_to_message_id": third["id"]}, headers=aarav.headers)
    assert summary(client, aarav, conversation["id"])["unread_count"] == 0

    # The pointer never moves backwards.
    client.post(f"{url}/read", json={"up_to_message_id": first["id"]}, headers=aarav.headers)
    assert summary(client, aarav, conversation["id"])["unread_count"] == 0


def test_system_messages_are_not_unread(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    g = group(client, aarav, "Climbers", maya)
    assert summary(client, maya, g["id"])["unread_count"] == 0
    assert summary(client, maya, g["id"])["last_message"]["kind"] == "system"


def test_read_requires_message_in_conversation(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    with_maya = direct(client, aarav, maya)
    with_kai = direct(client, aarav, kai)
    other = send(client, kai, with_kai["id"], "hi")
    response = client.post(
        f"/api/conversations/{with_maya['id']}/read",
        json={"up_to_message_id": other["id"]},
        headers=aarav.headers,
    )
    assert response.status_code == 404


def test_pagination_is_newest_first_by_cursor(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    url = f"/api/conversations/{conversation['id']}/messages"
    ids = [send(client, aarav, conversation["id"], f"m{i}")["id"] for i in range(5)]

    page = client.get(url, params={"limit": 2}, headers=aarav.headers).json()
    assert [m["id"] for m in page] == [ids[4], ids[3]]
    page = client.get(url, params={"limit": 2, "before_id": ids[3]}, headers=aarav.headers).json()
    assert [m["id"] for m in page] == [ids[2], ids[1]]


def test_reply_shows_quoted_message(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    original = send(client, maya, conversation["id"], "pizza tonight?")
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"body": "yes!", "client_id": "r1", "reply_to_id": original["id"]},
        headers=aarav.headers,
    )
    assert response.json()["reply_to"] == {
        "id": original["id"],
        "sender_id": maya.id,
        "body": "pizza tonight?",
        "deleted": False,
        "attachment": None,
    }


def test_reply_must_be_in_same_conversation(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    with_maya = direct(client, aarav, maya)
    with_kai = direct(client, aarav, kai)
    elsewhere = send(client, kai, with_kai["id"], "secret")
    response = client.post(
        f"/api/conversations/{with_maya['id']}/messages",
        json={"body": "re", "client_id": "r1", "reply_to_id": elsewhere["id"]},
        headers=aarav.headers,
    )
    assert response.status_code == 400


def test_reactions_replace_and_remove(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    url = f"/api/conversations/{conversation['id']}/messages"
    message = send(client, maya, conversation["id"], "summit!")
    reaction_url = f"/api/messages/{message['id']}/reaction"

    assert client.put(reaction_url, json={"emoji": "👍"}, headers=aarav.headers).status_code == 204
    client.put(reaction_url, json={"emoji": "❤️"}, headers=aarav.headers)
    client.put(reaction_url, json={"emoji": "🔥"}, headers=maya.headers)
    reactions = client.get(url, headers=aarav.headers).json()[0]["reactions"]
    assert reactions == [{"emoji": "❤️", "user_id": aarav.id}, {"emoji": "🔥", "user_id": maya.id}]

    assert client.delete(reaction_url, headers=aarav.headers).status_code == 204
    assert client.get(url, headers=aarav.headers).json()[0]["reactions"] == [
        {"emoji": "🔥", "user_id": maya.id}
    ]


def test_delete_for_everyone(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    message = send(client, maya, conversation["id"], "oops wrong chat")

    assert client.delete(f"/api/messages/{message['id']}", headers=aarav.headers).status_code == 403
    assert client.delete(f"/api/messages/{message['id']}", headers=maya.headers).status_code == 204

    stored = client.get(
        f"/api/conversations/{conversation['id']}/messages", headers=aarav.headers
    ).json()[0]
    assert stored["deleted"] is True and stored["body"] == ""
    assert summary(client, aarav, conversation["id"])["unread_count"] == 0


def test_disappearing_messages_expire(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    client.patch(
        f"/api/conversations/{conversation['id']}",
        json={"disappearing_seconds": 30},
        headers=aarav.headers,
    )
    message = send(client, aarav, conversation["id"], "self-destructs")

    db = client.app.state.db
    media_dir = client.app.state.settings.media_dir
    with db.session() as session:
        assert expire_due_messages(session, utcnow(), media_dir) == []
        expired = expire_due_messages(session, utcnow() + timedelta(seconds=31), media_dir)
        assert [m.id for m in expired] == [message["id"]]

    stored = client.get(
        f"/api/conversations/{conversation['id']}/messages", headers=aarav.headers
    ).json()[0]
    assert stored["deleted"] is True


def test_sender_can_edit_within_a_day(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    message = send(client, aarav, conversation["id"], "helo")

    edited = client.patch(
        f"/api/messages/{message['id']}", json={"body": "hello"}, headers=aarav.headers
    )
    assert edited.status_code == 200
    assert edited.json()["body"] == "hello" and edited.json()["edited"] is True

    history = client.get(
        f"/api/conversations/{conversation['id']}/messages", headers=maya.headers
    ).json()
    assert history[0]["body"] == "hello" and history[0]["edited"] is True

    other = client.patch(
        f"/api/messages/{message['id']}", json={"body": "mine"}, headers=maya.headers
    )
    assert other.status_code == 403


def test_edit_after_a_day_is_rejected(client, signup, monkeypatch):
    from app.services import messages as message_service

    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    message = send(client, aarav, conversation["id"], "old")
    later = utcnow() + timedelta(hours=25)
    monkeypatch.setattr(message_service, "utcnow", lambda: later)
    response = client.patch(
        f"/api/messages/{message['id']}", json={"body": "new"}, headers=aarav.headers
    )
    assert response.status_code == 400


def test_hide_removes_message_for_me_only(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    message = send(client, aarav, conversation["id"], "hello")
    url = f"/api/conversations/{conversation['id']}/messages"

    assert (
        client.post(f"/api/messages/{message['id']}/hide", headers=maya.headers).status_code == 204
    )
    assert (
        client.post(f"/api/messages/{message['id']}/hide", headers=maya.headers).status_code == 204
    )
    assert client.get(url, headers=maya.headers).json() == []
    assert len(client.get(url, headers=aarav.headers).json()) == 1


def test_new_nullable_columns_are_added_to_an_old_database(tmp_path):
    from sqlalchemy import inspect, text

    from app.db import Database

    database = Database(f"sqlite:///{tmp_path / 'old.db'}")
    database.create_all()
    with database.engine.begin() as connection:
        connection.execute(text("ALTER TABLE messages DROP COLUMN edited_at"))
    database.create_all()
    columns = {c["name"] for c in inspect(database.engine).get_columns("messages")}
    assert "edited_at" in columns
