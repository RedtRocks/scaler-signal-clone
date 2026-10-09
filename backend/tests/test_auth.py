def test_request_otp_reports_whether_phone_is_registered(client, signup):
    response = client.post("/api/auth/request-otp", json={"phone": "+14155550123"})
    assert response.json() == {"phone": "+14155550123", "is_registered": False}

    maya = signup("Maya")
    response = client.post("/api/auth/request-otp", json={"phone": maya.phone})
    assert response.json()["is_registered"] is True


def test_invalid_phone_is_rejected(client):
    assert client.post("/api/auth/request-otp", json={"phone": "555-1234"}).status_code == 422


def test_verify_otp_creates_user_and_session(client):
    response = client.post("/api/auth/verify-otp", json={"phone": "+14155550124", "code": "123456"})
    assert response.status_code == 200
    data = response.json()
    assert data["is_new"] is True
    assert data["user"]["display_name"] == ""
    assert data["user"]["created_at"].endswith("Z")

    headers = {"Authorization": f"Bearer {data['token']}"}
    assert client.get("/api/me", headers=headers).json()["phone"] == "+14155550124"


def test_wrong_code_is_400(client):
    response = client.post("/api/auth/verify-otp", json={"phone": "+14155550124", "code": "000000"})
    assert response.status_code == 400
    assert response.json() == {"detail": "That code is incorrect"}


def test_returning_user_with_profile_is_not_new(client, signup):
    maya = signup("Maya")
    response = client.post("/api/auth/verify-otp", json={"phone": maya.phone, "code": "123456"})
    assert response.json()["is_new"] is False
    assert response.json()["user"]["id"] == maya.id


def test_requests_without_valid_token_are_401(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_logout_ends_only_that_session(client, signup):
    maya = signup("Maya")
    second = client.post(
        "/api/auth/verify-otp", json={"phone": maya.phone, "code": "123456"}
    ).json()
    second_headers = {"Authorization": f"Bearer {second['token']}"}

    assert client.post("/api/auth/logout", headers=maya.headers).status_code == 204
    assert client.get("/api/me", headers=maya.headers).status_code == 401
    assert client.get("/api/me", headers=second_headers).status_code == 200


def test_update_profile(client, signup):
    maya = signup("Maya")
    response = client.patch(
        "/api/me", json={"about": "Climbing", "display_name": " Maya P "}, headers=maya.headers
    )
    assert response.json()["about"] == "Climbing"
    assert response.json()["display_name"] == "Maya P"
    assert (
        client.patch("/api/me", json={"display_name": ""}, headers=maya.headers).status_code == 422
    )


def test_avatar_upload_is_served_from_media(client, signup):
    maya = signup("Maya")
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    response = client.post(
        "/api/me/avatar", files={"file": ("me.png", png, "image/png")}, headers=maya.headers
    )
    assert response.status_code == 200
    avatar_url = response.json()["avatar_url"]
    assert avatar_url.startswith("/media/avatars/")
    assert client.get(avatar_url).content == png


def test_avatar_rejects_non_images_and_large_files(client, signup):
    maya = signup("Maya")
    text = client.post(
        "/api/me/avatar", files={"file": ("a.txt", b"hi", "text/plain")}, headers=maya.headers
    )
    assert text.status_code == 400
    big = b"0" * (2 * 1024 * 1024 + 1)
    large = client.post(
        "/api/me/avatar", files={"file": ("a.png", big, "image/png")}, headers=maya.headers
    )
    assert large.status_code == 400


def test_profile_picture_must_be_one_of_our_own_uploads(client, signup):
    maya = signup("Maya")
    elsewhere = client.patch(
        "/api/me", json={"avatar_url": "http://evil.example/x.png"}, headers=maya.headers
    )
    assert elsewhere.status_code == 422
    ours = client.patch(
        "/api/me", json={"avatar_url": "/media/avatars/1-a.png"}, headers=maya.headers
    )
    assert ours.status_code == 200
    cleared = client.patch("/api/me", json={"avatar_url": ""}, headers=maya.headers)
    assert cleared.json()["avatar_url"] is None


def test_fake_and_malformed_numbers_are_rejected(client):
    for phone in ["+15551234567", "+11234567890", "+1555", "5550001111", "+441234", "abc"]:
        response = client.post("/api/auth/request-otp", json={"phone": phone})
        assert response.status_code == 422, phone
        response = client.post("/api/auth/verify-otp", json={"phone": phone, "code": "123456"})
        assert response.status_code == 422, phone


def test_real_numbers_and_demo_accounts_are_accepted(client):
    for phone in ["+919876543210", "+442071838750", "+14155552671", "+15550000001", "+15550000005"]:
        assert client.post("/api/auth/request-otp", json={"phone": phone}).status_code == 200, phone
