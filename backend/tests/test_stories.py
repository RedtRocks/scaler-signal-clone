from datetime import timedelta

from app.db import utcnow
from tests.conftest import direct


def post_story(client, account, body="hello", background="crimson"):
    response = client.post(
        "/api/stories", json={"body": body, "background": background}, headers=account.headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_story_reaches_people_you_share_a_chat_with(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")
    direct(client, aarav, maya)
    story = post_story(client, aarav)
    assert story["background"] == "crimson" and story["viewed"] is True

    seen_by_maya = client.get("/api/stories", headers=maya.headers).json()
    assert [s["id"] for s in seen_by_maya] == [story["id"]]
    assert seen_by_maya[0]["viewed"] is False and seen_by_maya[0]["views"] is None
    assert client.get("/api/stories", headers=kai.headers).json() == []
    assert client.post(f"/api/stories/{story['id']}/view", headers=kai.headers).status_code == 404


def test_views_are_recorded_once_and_shown_to_the_author(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    direct(client, aarav, maya)
    story = post_story(client, aarav)
    for _ in range(2):
        response = client.post(f"/api/stories/{story['id']}/view", headers=maya.headers)
        assert response.status_code == 204
    assert client.get("/api/stories", headers=maya.headers).json()[0]["viewed"] is True
    views = client.get("/api/stories", headers=aarav.headers).json()[0]["views"]
    assert [v["user"]["id"] for v in views] == [maya.id]


def test_only_the_author_deletes(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    direct(client, aarav, maya)
    story = post_story(client, aarav)
    assert client.delete(f"/api/stories/{story['id']}", headers=maya.headers).status_code == 403
    assert client.delete(f"/api/stories/{story['id']}", headers=aarav.headers).status_code == 204
    assert client.get("/api/stories", headers=maya.headers).json() == []


def test_stories_expire_after_a_day(client, signup, monkeypatch):
    from app.services import stories

    aarav = signup("Aarav")
    post_story(client, aarav)
    later = utcnow() + timedelta(hours=25)
    monkeypatch.setattr(stories, "utcnow", lambda: later)
    assert client.get("/api/stories", headers=aarav.headers).json() == []
    with client.app.state.db.session() as db:
        assert stories.delete_expired(db) == 1


def test_story_validation(client, signup):
    aarav = signup("Aarav")
    blank = client.post("/api/stories", json={"body": "  "}, headers=aarav.headers)
    odd = client.post(
        "/api/stories", json={"body": "x", "background": "neon"}, headers=aarav.headers
    )
    assert blank.status_code == 422 and odd.status_code == 422


def post_photo(client, account, caption="sunset", data=None, content_type="image/png"):
    from tests.test_attachments import png

    return client.post(
        "/api/stories/photo",
        files={"file": ("p.png", png(8, 6) if data is None else data, content_type)},
        data={"caption": caption},
        headers=account.headers,
    )


def test_photo_story_is_stored_listed_and_removed_with_the_story(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    direct(client, aarav, maya)
    response = post_photo(client, aarav)
    assert response.status_code == 201, response.text
    story = response.json()
    assert story["body"] == "sunset" and story["media_url"].startswith("/media/stories/")
    seen = client.get("/api/stories", headers=maya.headers).json()
    assert seen[0]["media_url"] == story["media_url"]
    folder = client.app.state.settings.media_dir / "stories"
    assert len(list(folder.glob("*"))) == 1
    assert client.get(story["media_url"]).status_code == 200
    assert client.delete(f"/api/stories/{story['id']}", headers=aarav.headers).status_code == 204
    assert list(folder.glob("*")) == []


def test_photo_story_rejects_non_images_and_long_captions(client, signup):
    aarav = signup("Aarav")
    assert post_photo(client, aarav, data=b"hello", content_type="text/plain").status_code == 400
    assert post_photo(client, aarav, data=b"not a png").status_code == 400
    assert post_photo(client, aarav, caption="x" * 701).status_code == 400
