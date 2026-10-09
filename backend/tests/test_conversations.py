from sqlalchemy import event

from tests.conftest import direct, group, send, summary


def test_direct_conversation_is_unique_per_pair(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    first = direct(client, aarav, maya)
    again = direct(client, aarav, maya)
    from_other_side = direct(client, maya, aarav)
    assert first["id"] == again["id"] == from_other_side["id"]
    assert first["kind"] == "direct"
    assert first["member_count"] == 2
    assert first["my_role"] == "member"


def test_direct_with_unknown_user(client, signup):
    aarav = signup("Aarav")
    assert (
        client.post(
            "/api/conversations/direct", json={"user_id": 999}, headers=aarav.headers
        ).status_code
        == 404
    )


def test_note_to_self(client, signup):
    aarav = signup("Aarav")
    note = direct(client, aarav, aarav)
    assert note["title"] == "Note to Self"
    assert note["member_count"] == 1
    assert note["peer"]["id"] == aarav.id
    assert direct(client, aarav, aarav)["id"] == note["id"]
    message = send(client, aarav, note["id"], "remember the milk")
    assert message["status"] == "sent"
    assert summary(client, aarav, note["id"])["unread_count"] == 0


def test_non_members_get_404(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    conversation = direct(client, aarav, maya)
    assert (
        client.get(f"/api/conversations/{conversation['id']}", headers=kai.headers).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/conversations/{conversation['id']}/messages", headers=kai.headers
        ).status_code
        == 404
    )


def test_create_group_writes_system_messages(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    created = group(client, aarav, "Climbers", maya, kai)
    assert created["title"] == "Climbers"
    assert created["my_role"] == "admin"
    assert created["member_count"] == 3

    history = client.get(
        f"/api/conversations/{created['id']}/messages", headers=maya.headers
    ).json()
    events = [m["system_event"] for m in reversed(history)]
    assert events == [
        {"type": "group_created"},
        {"type": "members_added", "user_ids": [maya.id, kai.id]},
    ]
    assert all(m["kind"] == "system" and m["sender_id"] == aarav.id for m in history)

    detail = client.get(f"/api/conversations/{created['id']}", headers=maya.headers).json()
    assert detail["my_role"] == "member"
    assert {m["user"]["id"]: m["role"] for m in detail["members"]} == {
        aarav.id: "admin",
        maya.id: "member",
        kai.id: "member",
    }


def test_only_admins_rename_and_add(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    g = group(client, aarav, "Climbers", maya)
    url = f"/api/conversations/{g['id']}"

    assert client.patch(url, json={"name": "Hacked"}, headers=maya.headers).status_code == 403
    assert (
        client.post(f"{url}/members", json={"user_ids": [kai.id]}, headers=maya.headers).status_code
        == 403
    )

    renamed = client.patch(
        url, json={"name": "Rock climbers", "description": "Weekends"}, headers=aarav.headers
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Rock climbers"
    detail = client.get(url, headers=maya.headers).json()
    assert detail["description"] == "Weekends"

    added = client.post(f"{url}/members", json={"user_ids": [kai.id]}, headers=aarav.headers)
    assert added.json()["member_count"] == 3

    last = client.get(f"{url}/messages", headers=aarav.headers).json()[0]
    assert last["system_event"] == {"type": "members_added", "user_ids": [kai.id]}


def test_direct_conversation_timer_by_either_member(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    url = f"/api/conversations/{conversation['id']}"
    response = client.patch(url, json={"disappearing_seconds": 3600}, headers=maya.headers)
    assert response.json()["disappearing_seconds"] == 3600
    assert client.patch(url, json={"name": "nope"}, headers=aarav.headers).status_code == 400

    message = send(client, aarav, conversation["id"], "this will vanish")
    assert message["expires_at"] is not None

    off = client.patch(url, json={"disappearing_seconds": None}, headers=aarav.headers).json()
    assert off["disappearing_seconds"] is None
    events = [
        m["system_event"]
        for m in client.get(f"{url}/messages", headers=aarav.headers).json()
        if m["kind"] == "system"
    ]
    assert events == [
        {"type": "timer_changed", "seconds": None},
        {"type": "timer_changed", "seconds": 3600},
    ]


def test_admin_removes_member(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    g = group(client, aarav, "Climbers", maya, kai)
    url = f"/api/conversations/{g['id']}"
    send(client, aarav, g["id"], "before")

    assert client.delete(f"{url}/members/{kai.id}", headers=maya.headers).status_code == 403
    assert client.delete(f"{url}/members/{kai.id}", headers=aarav.headers).status_code == 204

    kai_view = summary(client, kai, g["id"])
    assert kai_view["left"] is True
    send(client, aarav, g["id"], "after")
    kai_history = [m["body"] for m in client.get(f"{url}/messages", headers=kai.headers).json()]
    assert "after" not in kai_history and "before" in kai_history
    # Kai still sees the system message that removed him.
    assert client.get(f"{url}/messages", headers=kai.headers).json()[0]["system_event"] == {
        "type": "member_removed",
        "user_id": kai.id,
    }
    # A removed member can no longer post.
    response = client.post(
        f"{url}/messages", json={"body": "hi", "client_id": "k1"}, headers=kai.headers
    )
    assert response.status_code == 403


def test_last_admin_leaving_promotes_oldest_member(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    g = group(client, aarav, "Climbers", maya)
    url = f"/api/conversations/{g['id']}"
    client.post(f"{url}/members", json={"user_ids": [kai.id]}, headers=aarav.headers)

    assert client.delete(f"{url}/members/{aarav.id}", headers=aarav.headers).status_code == 204

    detail = client.get(url, headers=maya.headers).json()
    assert detail["my_role"] == "admin"
    assert {m["user"]["id"] for m in detail["members"]} == {maya.id, kai.id}
    events = [
        m["system_event"] for m in client.get(f"{url}/messages", headers=maya.headers).json()[:2]
    ]
    assert events == [{"type": "admin_granted", "user_id": maya.id}, {"type": "member_left"}]


def test_detail_lists_former_members_so_old_messages_keep_names(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    g = group(client, aarav, "Climbers", maya)
    url = f"/api/conversations/{g['id']}"
    client.delete(f"{url}/members/{maya.id}", headers=maya.headers)

    detail = client.get(url, headers=aarav.headers).json()
    assert [m["user"]["id"] for m in detail["members"]] == [aarav.id]
    assert [u["id"] for u in detail["former_members"]] == [maya.id]


def test_readding_a_member_clears_left(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    g = group(client, aarav, "Climbers", maya)
    url = f"/api/conversations/{g['id']}"
    client.delete(f"{url}/members/{maya.id}", headers=maya.headers)
    client.post(f"{url}/members", json={"user_ids": [maya.id]}, headers=aarav.headers)
    assert summary(client, maya, g["id"])["left"] is False


def test_grant_and_revoke_admin(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    g = group(client, aarav, "Climbers", maya)
    url = f"/api/conversations/{g['id']}/members"

    assert (
        client.patch(
            f"{url}/{aarav.id}", json={"role": "member"}, headers=aarav.headers
        ).status_code
        == 400
    )
    assert (
        client.patch(f"{url}/{maya.id}", json={"role": "admin"}, headers=aarav.headers).status_code
        == 204
    )
    assert (
        client.patch(f"{url}/{aarav.id}", json={"role": "member"}, headers=maya.headers).status_code
        == 204
    )
    assert summary(client, aarav, g["id"])["my_role"] == "member"


def test_cannot_leave_direct_conversation(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    conversation = direct(client, aarav, maya)
    response = client.delete(
        f"/api/conversations/{conversation['id']}/members/{aarav.id}", headers=aarav.headers
    )
    assert response.status_code == 400


def test_settings_are_per_member_and_pinned_sorts_first(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    with_maya = direct(client, aarav, maya)
    with_kai = direct(client, aarav, kai)
    send(client, aarav, with_maya["id"], "older")
    send(client, aarav, with_kai["id"], "newer")

    order = [c["id"] for c in client.get("/api/conversations", headers=aarav.headers).json()]
    assert order == [with_kai["id"], with_maya["id"]]

    response = client.patch(
        f"/api/conversations/{with_maya['id']}/settings",
        json={"pinned": True, "muted": True},
        headers=aarav.headers,
    )
    assert response.json()["pinned"] is True and response.json()["muted"] is True
    order = [c["id"] for c in client.get("/api/conversations", headers=aarav.headers).json()]
    assert order == [with_maya["id"], with_kai["id"]]
    assert summary(client, maya, with_maya["id"])["pinned"] is False


def test_search(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    client.post(
        "/api/contacts",
        json={"phone": maya.phone, "nickname": "Bouldering buddy"},
        headers=aarav.headers,
    )
    conversation = direct(client, aarav, maya)
    group(client, aarav, "Weekend crew", kai)
    send(client, maya, conversation["id"], "Shall we go BOULDERING on Saturday?")

    results = client.get("/api/search", params={"q": "boulder"}, headers=aarav.headers).json()
    assert [c["title"] for c in results["conversations"]] == ["Bouldering buddy"]
    assert [c["user"]["id"] for c in results["contacts"]] == [maya.id]
    assert len(results["messages"]) == 1
    assert results["messages"][0]["conversation_title"] == "Bouldering buddy"

    results = client.get("/api/search", params={"q": "weekend"}, headers=aarav.headers).json()
    assert [c["title"] for c in results["conversations"]] == ["Weekend crew"]
    # Kai is not in the conversation with Maya, so he can't find her message.
    assert (
        client.get("/api/search", params={"q": "saturday"}, headers=kai.headers).json()["messages"]
        == []
    )


def test_conversation_list_query_count_does_not_grow_with_conversations(client, signup):
    """GET /api/conversations batches its lookups, so it has no N+1 queries."""
    aarav = signup("Aarav")
    engine = client.app.state.db.engine

    def queries_for_list() -> int:
        statements = []

        def record(*_args) -> None:
            statements.append(1)

        event.listen(engine, "before_cursor_execute", record)
        response = client.get("/api/conversations", headers=aarav.headers)
        event.remove(engine, "before_cursor_execute", record)
        assert response.status_code == 200
        return len(statements)

    friends = [signup(f"Friend {i}") for i in range(6)]
    for friend in friends[:2]:
        send(client, friend, direct(client, aarav, friend)["id"], "hi")
    with_two = queries_for_list()

    for friend in friends[2:]:
        send(client, friend, direct(client, aarav, friend)["id"], "hi")
    group(client, aarav, "Everyone", *friends)
    assert queries_for_list() == with_two


def test_chat_color_is_per_member_and_can_be_cleared(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    url = f"/api/conversations/{c['id']}/settings"
    assert (
        client.patch(url, json={"chat_color": "crimson"}, headers=aarav.headers).status_code == 200
    )
    mine = next(
        x
        for x in client.get("/api/conversations", headers=aarav.headers).json()
        if x["id"] == c["id"]
    )
    theirs = next(
        x
        for x in client.get("/api/conversations", headers=maya.headers).json()
        if x["id"] == c["id"]
    )
    assert mine["chat_color"] == "crimson" and theirs["chat_color"] is None
    assert (
        client.patch(url, json={"chat_color": "hotpink"}, headers=aarav.headers).status_code == 422
    )
    assert (
        client.patch(url, json={"chat_color": "default"}, headers=aarav.headers).status_code == 200
    )
    again = next(
        x
        for x in client.get("/api/conversations", headers=aarav.headers).json()
        if x["id"] == c["id"]
    )
    assert again["chat_color"] is None
