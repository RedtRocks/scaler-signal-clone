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
