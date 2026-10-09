from __future__ import annotations

from tests.helpers import document_content, para


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_login_me(client, auth):
    me = client.get("/api/auth/me", headers=auth["headers"])
    assert me.status_code == 200
    assert me.json()["email"] == "writer@example.com"


def test_duplicate_email_conflicts(client, auth):
    response = client.post(
        "/api/auth/register",
        json={"email": "writer@example.com", "password": "supersecret", "full_name": "X"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_short_password_rejected(client):
    response = client.post(
        "/api/auth/register", json={"email": "a@b.co", "password": "short", "full_name": ""}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_document_lifecycle(client, auth):
    created = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={
            "title": "Report",
            "content": document_content("Report"),
            "workspace_id": auth["workspace_id"],
        },
    )
    assert created.status_code == 201, created.text
    document = created.json()
    assert document["revision"] == 1

    fetched = client.get(f"/api/documents/{document['id']}", headers=auth["headers"])
    assert fetched.status_code == 200

    listing = client.get(f"/api/documents?workspace_id={auth['workspace_id']}&q=Rep", headers=auth["headers"])
    assert listing.status_code == 200
    assert any(item["id"] == document["id"] for item in listing.json())

    updated_content = document_content("Report")
    updated_content["blocks"] = [para("<p>Updated body</p>")]
    updated = client.put(
        f"/api/documents/{document['id']}",
        headers=auth["headers"],
        json={"content": updated_content, "expected_revision": 1},
    )
    assert updated.status_code == 200
    assert updated.json()["revision"] == 2


def test_stale_revision_is_rejected(client, auth):
    created = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={"title": "Doc", "content": document_content(), "workspace_id": auth["workspace_id"]},
    ).json()
    first = client.put(
        f"/api/documents/{created['id']}",
        headers=auth["headers"],
        json={"content": document_content("Doc"), "expected_revision": 1},
    )
    assert first.status_code == 200

    stale = client.put(
        f"/api/documents/{created['id']}",
        headers=auth["headers"],
        json={"content": document_content("Doc"), "expected_revision": 1},
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "conflict"


def test_revisions_are_created_and_restorable(client, auth):
    created = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={
            "title": "Versioned",
            "content": document_content("Versioned"),
            "workspace_id": auth["workspace_id"],
        },
    ).json()

    client.put(
        f"/api/documents/{created['id']}",
        headers=auth["headers"],
        json={"content": document_content("Versioned v2"), "expected_revision": 1, "create_revision": True},
    )

    revisions = client.get(f"/api/documents/{created['id']}/revisions", headers=auth["headers"]).json()
    assert len(revisions) >= 2

    original = revisions[-1]
    restored = client.post(
        f"/api/documents/{created['id']}/revisions/{original['id']}/restore", headers=auth["headers"]
    )
    assert restored.status_code == 200
    assert restored.json()["content"]["title"] == "Versioned"


def test_duplicate_document(client, auth):
    created = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={
            "title": "Original",
            "content": document_content("Original"),
            "workspace_id": auth["workspace_id"],
        },
    ).json()
    duplicate = client.post(f"/api/documents/{created['id']}/duplicate", headers=auth["headers"])
    assert duplicate.status_code == 201
    assert duplicate.json()["title"] == "Original (copy)"
    assert duplicate.json()["id"] != created["id"]


def test_users_cannot_access_other_users_documents(client, auth):
    created = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={
            "title": "Private",
            "content": document_content("Private"),
            "workspace_id": auth["workspace_id"],
        },
    ).json()

    other = client.post(
        "/api/auth/register",
        json={"email": "intruder@example.com", "password": "supersecret", "full_name": "Intruder"},
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    assert client.get(f"/api/documents/{created['id']}", headers=other_headers).status_code == 403
    assert (
        client.put(
            f"/api/documents/{created['id']}",
            headers=other_headers,
            json={"content": document_content("Hacked")},
        ).status_code
        == 403
    )
    assert client.delete(f"/api/documents/{created['id']}", headers=other_headers).status_code == 403
