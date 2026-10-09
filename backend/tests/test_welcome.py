from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Database
from app.main import create_app
from app.seed import seed


def test_new_signup_starts_empty_with_demo_contacts(tmp_path: Path) -> None:
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'demo.db'}", media_dir=tmp_path / "m")
    database = Database(settings.database_url)
    database.create_all()
    with database.session() as session:
        seed(session, settings.media_dir)

    with TestClient(create_app(settings)) as client:
        auth = client.post("/api/auth/verify-otp", json={"phone": "+14155550126", "code": "123456"})
        headers = {"Authorization": f"Bearer {auth.json()['token']}"}
        chats = client.get("/api/conversations", headers=headers)
        assert chats.status_code == 200, chats.text
        items = chats.json()
        items = items.get("items", items) if isinstance(items, dict) else items
        assert items == []
        contacts = client.get("/api/contacts", headers=headers)
        assert contacts.status_code == 200, contacts.text
        assert "Maya Patel" in contacts.text

        # A reviewer account keeps its own pre-filled chats.
        auth = client.post("/api/auth/verify-otp", json={"phone": "+15550000005", "code": "123456"})
        headers = {"Authorization": f"Bearer {auth.json()['token']}"}
        assert "Family" in client.get("/api/conversations", headers=headers).text
