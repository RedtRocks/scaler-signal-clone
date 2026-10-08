from tests.conftest import direct


def test_add_list_rename_delete_contact(client, signup):
    aarav, maya, kai = signup("Aarav"), signup("Maya"), signup("Kai")

    response = client.post(
        "/api/contacts", json={"phone": maya.phone, "nickname": "Mayu"}, headers=aarav.headers
    )
    assert response.status_code == 201
    assert response.json()["display_name"] == "Mayu"
    assert response.json()["user"]["display_name"] == "Maya"
    client.post("/api/contacts", json={"phone": kai.phone}, headers=aarav.headers)

    names = [c["display_name"] for c in client.get("/api/contacts", headers=aarav.headers).json()]
    assert names == ["Kai", "Mayu"]

    renamed = client.patch(f"/api/contacts/{maya.id}", json={"nickname": ""}, headers=aarav.headers)
    assert renamed.json()["nickname"] is None
    assert renamed.json()["display_name"] == "Maya"

    assert client.delete(f"/api/contacts/{kai.id}", headers=aarav.headers).status_code == 204
    assert len(client.get("/api/contacts", headers=aarav.headers).json()) == 1


def test_contacts_are_one_way(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    client.post("/api/contacts", json={"phone": maya.phone}, headers=aarav.headers)
    assert client.get("/api/contacts", headers=maya.headers).json() == []


def test_contact_errors(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    assert (
        client.post(
            "/api/contacts", json={"phone": "+15559999999"}, headers=aarav.headers
        ).status_code
        == 404
    )
    assert (
        client.post("/api/contacts", json={"phone": aarav.phone}, headers=aarav.headers).status_code
        == 400
    )
    client.post("/api/contacts", json={"phone": maya.phone}, headers=aarav.headers)
    assert (
        client.post("/api/contacts", json={"phone": maya.phone}, headers=aarav.headers).status_code
        == 409
    )
    assert (
        client.patch("/api/contacts/999", json={"nickname": "x"}, headers=aarav.headers).status_code
        == 404
    )


def test_lookup_user_by_phone(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    response = client.get("/api/users/lookup", params={"phone": maya.phone}, headers=aarav.headers)
    assert response.json()["id"] == maya.id
    assert response.json()["online"] is False
    missing = client.get(
        "/api/users/lookup", params={"phone": "+15559999999"}, headers=aarav.headers
    )
    assert missing.status_code == 404


def test_direct_title_uses_my_nickname(client, signup):
    aarav, maya = signup("Aarav"), signup("Maya")
    client.post(
        "/api/contacts",
        json={"phone": maya.phone, "nickname": "Climbing Maya"},
        headers=aarav.headers,
    )
    conversation = direct(client, aarav, maya)
    assert conversation["title"] == "Climbing Maya"
    assert conversation["peer"]["id"] == maya.id
    # Maya has no nickname for Aarav, so she sees his display name.
    assert direct(client, maya, aarav)["title"] == "Aarav"
