from collections.abc import Iterator
from dataclasses import dataclass
from itertools import count
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@dataclass
class Account:
    id: int
    token: str
    phone: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    """A fresh app on its own temporary SQLite database."""
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        media_dir=tmp_path / "media",
        expiry_interval_seconds=3600,  # tests call the expiry function directly
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def signup(client: TestClient):
    """Create a signed-in user: `signup("Maya")` -> Account."""
    phones = count(1)

    def _signup(name: str) -> Account:
        phone = f"+1555000{next(phones):04d}"
        response = client.post("/api/auth/verify-otp", json={"phone": phone, "code": "123456"})
        assert response.status_code == 200, response.text
        token = response.json()["token"]
        account = Account(id=response.json()["user"]["id"], token=token, phone=phone)
        client.patch("/api/me", json={"display_name": name}, headers=account.headers)
        return account

    return _signup


def send(
    client: TestClient,
    sender: Account,
    conversation_id: int,
    body: str,
    client_id: str | None = None,
):
    response = client.post(
        f"/api/conversations/{conversation_id}/messages",
        json={"body": body, "client_id": client_id or f"{sender.id}-{body}"},
        headers=sender.headers,
    )
    assert response.status_code in (200, 201), response.text
    return response.json()


def direct(client: TestClient, me: Account, other: Account) -> dict:
    response = client.post(
        "/api/conversations/direct", json={"user_id": other.id}, headers=me.headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def group(client: TestClient, creator: Account, name: str, *members: Account) -> dict:
    response = client.post(
        "/api/conversations/group",
        json={"name": name, "member_ids": [m.id for m in members]},
        headers=creator.headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def summary(client: TestClient, viewer: Account, conversation_id: int) -> dict:
    conversations = client.get("/api/conversations", headers=viewer.headers).json()
    return next(c for c in conversations if c["id"] == conversation_id)
