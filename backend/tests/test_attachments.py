import struct
import zlib

from sqlalchemy import select

from app.db import utcnow
from app.models import Attachment
from app.services import attachments as attachment_service
from app.services.messages import expire_due_messages
from tests.conftest import direct, group, send, summary


def png(width: int = 4, height: int = 3) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    raw = b"".join(b"\x00" + b"\x10\x20\x30" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def upload(client, who, conversation_id, name="pic.png", data=None, content_type="image/png"):
    return client.post(
        f"/api/conversations/{conversation_id}/attachments",
        files={"file": (name, png() if data is None else data, content_type)},
        headers=who.headers,
    )


def post_message(client, who, conversation_id, client_id, body="", ids=(), **extra):
    return client.post(
        f"/api/conversations/{conversation_id}/messages",
        json={"body": body, "client_id": client_id, "attachment_ids": list(ids), **extra},
        headers=who.headers,
    )


def media_files(client):
    folder = client.app.state.settings.media_dir / "attachments"
    return sorted(p.name for p in folder.glob("*")) if folder.exists() else []


def test_upload_image_measures_size_and_stores_random_name(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    response = upload(client, aarav, c["id"], name="../../etc/holiday photo.PNG", data=png(7, 5))
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["width"], body["height"]) == (7, 5)
    assert body["file_name"] == "holiday photo.PNG"  # path parts stripped
    assert body["content_type"] == "image/png" and body["size"] == len(png(7, 5))
    assert body["url"].startswith("/media/attachments/") and body["url"].endswith(".png")
    assert "holiday" not in body["url"]
    # The file is really served.
    assert client.get(body["url"]).content == png(7, 5)


def test_upload_limits_and_allowlist(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    too_big = upload(
        client, aarav, c["id"], "x.pdf", b"%PDF" + b"0" * (10 * 1024 * 1024), "application/pdf"
    )
    assert too_big.status_code == 413 and "10 MB" in too_big.json()["detail"]
    exactly = upload(client, aarav, c["id"], "x.pdf", b"0" * (10 * 1024 * 1024), "application/pdf")
    assert exactly.status_code == 201

    for name, kind in [
        ("a.svg", "image/svg+xml"),
        ("a.html", "text/html"),
        ("a.exe", "application/x-msdownload"),
    ]:
        rejected = upload(client, aarav, c["id"], name, b"<script>alert(1)</script>", kind)
        assert rejected.status_code == 400, kind
        assert isinstance(rejected.json()["detail"], str)
    assert upload(client, aarav, c["id"], "e.txt", b"", "text/plain").status_code == 400
    fake = upload(client, aarav, c["id"], "fake.png", b"not really a png", "image/png")
    assert fake.status_code == 400
    assert len(media_files(client)) == 1  # only the accepted pdf is on disk


def test_other_file_types_are_accepted(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    for name, data, kind in [
        ("notes.txt", b"hi", "text/plain; charset=utf-8"),
        ("a.zip", b"PK\x03\x04", "application/x-zip-compressed"),
        ("song.mp3", b"ID3", "audio/mpeg"),
        ("clip.mp4", b"\x00\x00", "video/mp4"),
    ]:
        response = upload(client, aarav, c["id"], name, data, kind)
        assert response.status_code == 201, (name, response.text)
        assert response.json()["width"] is None


def test_only_active_members_can_upload_or_read_metadata(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    c = direct(client, aarav, maya)
    assert upload(client, kai, c["id"]).status_code == 404  # not a member

    shared = upload(client, aarav, c["id"]).json()
    # Unclaimed: only the uploader sees it.
    assert client.get(f"/api/attachments/{shared['id']}", headers=aarav.headers).status_code == 200
    assert client.get(f"/api/attachments/{shared['id']}", headers=maya.headers).status_code == 404

    post_message(client, aarav, c["id"], "m1", ids=[shared["id"]])
    assert client.get(f"/api/attachments/{shared['id']}", headers=maya.headers).status_code == 200
    assert client.get(f"/api/attachments/{shared['id']}", headers=kai.headers).status_code == 404
    assert client.get("/api/attachments/999", headers=kai.headers).status_code == 404
    assert client.get(f"/api/attachments/{shared['id']}").status_code == 401

    g = group(client, aarav, "Climbers", maya, kai)
    client.delete(f"/api/conversations/{g['id']}/members/{kai.id}", headers=kai.headers)
    assert upload(client, kai, g["id"]).status_code == 403  # left the group


def test_send_message_with_attachments_in_order(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    first = upload(client, aarav, c["id"], "one.png").json()
    second = upload(client, aarav, c["id"], "two.pdf", b"%PDF-1", "application/pdf").json()
    response = post_message(client, aarav, c["id"], "m1", "look", [second["id"], first["id"]])
    assert response.status_code == 201
    message = response.json()
    assert message["body"] == "look"
    assert [a["file_name"] for a in message["attachments"]] == ["two.pdf", "one.png"]

    history = client.get(f"/api/conversations/{c['id']}/messages", headers=maya.headers).json()
    assert [a["file_name"] for a in history[0]["attachments"]] == ["two.pdf", "one.png"]


def test_message_needs_text_or_attachment_and_caption_is_optional(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    assert post_message(client, aarav, c["id"], "e1").status_code == 422
    photo = upload(client, aarav, c["id"]).json()
    ok = post_message(client, aarav, c["id"], "e2", "", [photo["id"]])
    assert ok.status_code == 201 and ok.json()["body"] == ""


def test_claim_rules(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c, other = direct(client, aarav, maya), group(client, aarav, "G", maya)
    mine = upload(client, aarav, c["id"]).json()
    theirs = upload(client, maya, c["id"]).json()
    elsewhere = upload(client, aarav, other["id"]).json()

    assert post_message(client, aarav, c["id"], "a", ids=[theirs["id"]]).status_code == 400
    assert post_message(client, aarav, c["id"], "b", ids=[elsewhere["id"]]).status_code == 400
    assert (
        post_message(client, aarav, c["id"], "c", ids=[mine["id"], mine["id"]]).status_code == 400
    )
    assert post_message(client, aarav, c["id"], "d", ids=[12345]).status_code == 400
    # A failed claim leaves nothing behind: the file is still free to use.
    assert client.get(f"/api/conversations/{c['id']}/messages", headers=aarav.headers).json() == []
    assert post_message(client, aarav, c["id"], "e", ids=[mine["id"]]).status_code == 201
    # ... but only once.
    assert post_message(client, aarav, c["id"], "f", ids=[mine["id"]]).status_code == 400


def test_at_most_ten_attachments(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    ids = [upload(client, aarav, c["id"], f"{i}.png").json()["id"] for i in range(11)]
    too_many = post_message(client, aarav, c["id"], "x", ids=ids)
    assert too_many.status_code == 400 and "10" in too_many.json()["detail"]
    assert post_message(client, aarav, c["id"], "y", ids=ids[:10]).status_code == 201


def test_resend_with_same_client_id_is_idempotent(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    photo = upload(client, aarav, c["id"]).json()
    first = post_message(client, aarav, c["id"], "same", "hi", [photo["id"]])
    retry = post_message(client, aarav, c["id"], "same", "hi", [photo["id"]])
    assert (first.status_code, retry.status_code) == (201, 200)
    assert first.json()["id"] == retry.json()["id"]
    assert len(retry.json()["attachments"]) == 1
    assert (
        len(client.get(f"/api/conversations/{c['id']}/messages", headers=aarav.headers).json()) == 1
    )


def test_previews_search_and_quotes_include_attachments(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    photo = upload(client, aarav, c["id"], "sunset.png").json()
    message = post_message(client, aarav, c["id"], "p", "", [photo["id"]]).json()

    for viewer in (aarav, maya):
        last = summary(client, viewer, c["id"])["last_message"]
        assert [a["file_name"] for a in last["attachments"]] == ["sunset.png"]
    assert summary(client, maya, c["id"])["unread_count"] == 1  # an attachment is unread like text

    hits = client.get("/api/search", params={"q": "sunset"}, headers=maya.headers).json()
    assert [h["message"]["id"] for h in hits["messages"]] == [message["id"]]

    reply = post_message(client, maya, c["id"], "r", "nice", reply_to_id=message["id"]).json()
    assert reply["reply_to"]["attachment"]["file_name"] == "sunset.png"


def test_conversation_list_query_count_does_not_grow_with_attachments(client, signup):
    from sqlalchemy import event

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

    def chat_with_photo_and_quote(name: str) -> None:
        friend = signup(name)
        c = direct(client, aarav, friend)
        photo = upload(client, aarav, c["id"]).json()
        sent = post_message(client, aarav, c["id"], f"p-{name}", "", [photo["id"]]).json()
        post_message(client, friend, c["id"], f"r-{name}", "nice", reply_to_id=sent["id"])

    for name in ("A", "B"):
        chat_with_photo_and_quote(name)
    with_two = queries_for_list()
    for name in ("C", "D", "E"):
        chat_with_photo_and_quote(name)
    assert queries_for_list() == with_two


def test_delete_for_everyone_removes_files(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    photo = upload(client, aarav, c["id"]).json()
    message = post_message(client, aarav, c["id"], "d", "bye", [photo["id"]]).json()
    assert len(media_files(client)) == 1

    assert client.delete(f"/api/messages/{message['id']}", headers=aarav.headers).status_code == 204
    assert media_files(client) == []
    assert client.get(photo["url"]).status_code == 404
    assert client.get(f"/api/attachments/{photo['id']}", headers=maya.headers).status_code == 404
    history = client.get(f"/api/conversations/{c['id']}/messages", headers=maya.headers).json()
    assert history[0]["deleted"] is True and history[0]["attachments"] == []


def test_expiry_removes_files(client, signup):
    from datetime import timedelta

    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    client.patch(
        f"/api/conversations/{c['id']}", json={"disappearing_seconds": 30}, headers=aarav.headers
    )
    photo = upload(client, aarav, c["id"]).json()
    post_message(client, aarav, c["id"], "t", "", [photo["id"]])
    media_dir = client.app.state.settings.media_dir
    with client.app.state.db.session() as session:
        assert expire_due_messages(session, utcnow(), media_dir) == []
        assert len(media_files(client)) == 1
        assert len(expire_due_messages(session, utcnow() + timedelta(seconds=31), media_dir)) == 1
    assert media_files(client) == []


def test_unclaimed_uploads_are_purged_after_the_ttl(client, signup):
    from datetime import timedelta

    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    upload(client, aarav, c["id"])
    media_dir = client.app.state.settings.media_dir
    with client.app.state.db.session() as session:
        now = utcnow()
        assert attachment_service.purge_unclaimed(session, media_dir, now, 3600) == 0
        assert (
            attachment_service.purge_unclaimed(session, media_dir, now + timedelta(hours=2), 3600)
            == 1
        )
        assert session.scalars(select(Attachment)).all() == []
    assert media_files(client) == []


def test_new_message_is_pushed_with_attachments(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    photo = upload(client, aarav, c["id"], "live.png").json()
    with client.websocket_connect(f"/ws?token={maya.token}") as ws:
        assert ws.receive_json()["type"] == "hello"
        post_message(client, aarav, c["id"], "w", "see", [photo["id"]])
        event = ws.receive_json()
        assert event["type"] == "message.new"
        assert event["data"]["attachments"][0]["file_name"] == "live.png"


def test_plain_text_messages_still_work(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    assert send(client, aarav, c["id"], "hello")["attachments"] == []


def test_audio_upload_with_a_duration_is_a_voice_message(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    response = client.post(
        f"/api/conversations/{c['id']}/attachments",
        files={"file": ("Voice message.weba", b"OggS-not-really", "audio/webm")},
        data={"duration_ms": "4200"},
        headers=aarav.headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["duration_ms"] == 4200
    sent = post_message(client, aarav, c["id"], "v1", "", [response.json()["id"]]).json()
    assert sent["attachments"][0]["duration_ms"] == 4200


def test_duration_is_ignored_for_non_audio_and_capped(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    c = direct(client, aarav, maya)
    image = client.post(
        f"/api/conversations/{c['id']}/attachments",
        files={"file": ("pic.png", png(), "image/png")},
        data={"duration_ms": "5000"},
        headers=aarav.headers,
    )
    assert image.json()["duration_ms"] is None
    long_note = client.post(
        f"/api/conversations/{c['id']}/attachments",
        files={"file": ("v.wav", b"RIFF....", "audio/wav")},
        data={"duration_ms": str(10**9)},
        headers=aarav.headers,
    )
    assert long_note.json()["duration_ms"] == 3_600_000
    plain = upload(client, aarav, c["id"], "song.mp3", b"ID3", "audio/mpeg")
    assert plain.json()["duration_ms"] is None
