from __future__ import annotations

from app.database import SessionLocal
from app.models import User
from app.security import hash_password, verify_password
from app.services.tokens import resolve_tokens, sanitize_html
from tests.helpers import document_content, para


def test_passwords_are_hashed_not_stored_plaintext(client, auth):
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == "writer@example.com").one()
        assert user.password_hash != "supersecret"
        assert "supersecret" not in user.password_hash
        assert verify_password("supersecret", user.password_hash)
        assert not verify_password("wrong-password", user.password_hash)


def test_hash_is_salted():
    assert hash_password("same-password") != hash_password("same-password")


def test_sanitize_html_strips_dangerous_markup():
    dirty = '<p onclick="steal()">Hi <script>alert(1)</script><a href="javascript:evil()">x</a></p>'
    clean = sanitize_html(dirty)
    assert "<script" not in clean.lower()
    assert "onclick" not in clean.lower()
    assert "javascript:" not in clean.lower()


def test_sanitize_html_preserves_formatting():
    clean = sanitize_html("<p><strong>Bold</strong> and <em>italic</em></p>")
    assert "<strong>Bold</strong>" in clean
    assert "<em>italic</em>" in clean


def test_resolve_tokens_escapes_values():
    result = resolve_tokens("Hi {{name}}", {"name": "<script>alert(1)</script>"})
    assert "<script>" not in result
    assert "&lt;script&gt;" in result


def test_documents_are_sanitized_on_save(client, auth):
    content = document_content(
        "XSS", [para('<p>Safe <img src=x onerror="alert(1)"><script>alert(1)</script></p>')]
    )
    created = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={"title": "XSS", "content": content, "workspace_id": auth["workspace_id"]},
    ).json()
    stored = client.get(f"/api/documents/{created['id']}", headers=auth["headers"]).json()
    html = stored["content"]["blocks"][0].get("html", "")
    assert "<script" not in html.lower()
    assert "onerror" not in html.lower()


def test_protected_routes_require_auth(client):
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/workspaces", headers={"Authorization": "Bearer not-a-token"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
