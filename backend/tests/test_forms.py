from __future__ import annotations

from tests.helpers import document_content, field, heading, para


def make_form_document(client, auth):
    blocks = [
        heading("Enrolment"),
        para("<p>Please complete.</p>"),
        field("full_name", "Full name", "shortText", required=True, block_id="f1"),
        field("email", "Email", "email", required=True, block_id="f2"),
        field("age", "Age", "number", required=False, block_id="f3"),
    ]
    document = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={
            "title": "Enrolment",
            "content": document_content("Enrolment", blocks),
            "workspace_id": auth["workspace_id"],
        },
    ).json()
    publish = client.post(
        f"/api/forms/publish?document_id={document['id']}",
        headers=auth["headers"],
        json={
            "settings": {
                "title": "Enrolment",
                "description": "",
                "submitLabel": "Submit",
                "successMessage": "Thanks!",
                "allowMultiple": True,
                "requireAuth": False,
                "collectEmail": False,
            },
            "access_mode": "public",
            "status": "published",
        },
    )
    assert publish.status_code == 201, publish.text
    return document, publish.json()


def test_publish_and_public_read(client, auth):
    _, form = make_form_document(client, auth)
    public = client.get(f"/api/forms/public/{form['slug']}")
    assert public.status_code == 200
    body = public.json()
    assert [f["key"] for f in body["fields"]] == ["full_name", "email", "age"]
    assert body["document_title"] == "Enrolment"


def test_submit_valid_response(client, auth):
    _, form = make_form_document(client, auth)
    response = client.post(
        f"/api/forms/public/{form['slug']}/submit",
        json={"values": {"full_name": "Grace Hopper", "email": "grace@example.com", "age": "45"}},
    )
    assert response.status_code == 201, response.text
    assert response.json()["success_message"] == "Thanks!"

    responses = client.get(f"/api/forms/{form['id']}/responses", headers=auth["headers"]).json()
    assert len(responses) == 1
    assert responses[0]["data"]["full_name"] == "Grace Hopper"
    assert responses[0]["data"]["age"] == 45


def test_submit_missing_required_fields(client, auth):
    _, form = make_form_document(client, auth)
    response = client.post(f"/api/forms/public/{form['slug']}/submit", json={"values": {}})
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "bad_request"
    assert "full_name" in error["details"]["fields"]


def test_submit_invalid_email(client, auth):
    _, form = make_form_document(client, auth)
    response = client.post(
        f"/api/forms/public/{form['slug']}/submit",
        json={"values": {"full_name": "X", "email": "not-an-email"}},
    )
    assert response.status_code == 400
    assert "email" in response.json()["error"]["details"]["fields"]


def test_personalized_pdf_from_response(client, auth):
    _, form = make_form_document(client, auth)
    submitted = client.post(
        f"/api/forms/public/{form['slug']}/submit",
        json={"values": {"full_name": "Katherine Johnson", "email": "kj@example.com"}},
    ).json()
    generated = client.post(
        f"/api/forms/{form['id']}/responses/{submitted['id']}/pdf", headers=auth["headers"]
    )
    assert generated.status_code == 201, generated.text
    assert generated.json()["page_count"] == 1
    assert generated.json()["response_id"] == submitted["id"]


def test_publish_uses_current_content_after_unsnapshotted_edit(client, auth):
    blocks = [heading("Enrolment"), para("<p>Please complete.</p>")]
    document = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={
            "title": "Enrolment",
            "content": document_content("Enrolment", blocks),
            "workspace_id": auth["workspace_id"],
        },
    ).json()
    edited = document_content(
        "Enrolment",
        [*blocks, field("student_name", "Student name", "shortText", required=True, block_id="f1")],
    )
    assert (
        client.put(
            f"/api/documents/{document['id']}", headers=auth["headers"], json={"content": edited}
        ).status_code
        == 200
    )
    form = client.post(
        f"/api/forms/publish?document_id={document['id']}",
        headers=auth["headers"],
        json={
            "settings": {
                "title": "Enrolment",
                "description": "",
                "submitLabel": "Submit",
                "successMessage": "Thanks!",
                "allowMultiple": True,
                "requireAuth": False,
                "collectEmail": False,
            },
            "access_mode": "public",
            "status": "published",
        },
    ).json()
    public = client.get(f"/api/forms/public/{form['slug']}").json()
    assert [f["key"] for f in public["fields"]] == ["student_name"]


def test_list_forms_for_workspace(client, auth):
    _, form = make_form_document(client, auth)
    response = client.get(f"/api/forms?workspace_id={auth['workspace_id']}", headers=auth["headers"])
    assert response.status_code == 200, response.text
    forms = response.json()
    assert [f["id"] for f in forms] == [form["id"]]


def test_list_forms_requires_auth(client, auth):
    make_form_document(client, auth)
    assert client.get(f"/api/forms?workspace_id={auth['workspace_id']}").status_code == 401


def test_unknown_slug_is_404(client):
    assert client.get("/api/forms/public/does-not-exist").status_code == 404


def test_closed_form_cannot_be_submitted(client, auth):
    _, form = make_form_document(client, auth)
    client.post(
        f"/api/forms/publish?document_id={form['document_id']}",
        headers=auth["headers"],
        json={
            "settings": {
                "title": "Enrolment",
                "description": "",
                "submitLabel": "Submit",
                "successMessage": "Thanks!",
                "allowMultiple": True,
                "requireAuth": False,
                "collectEmail": False,
            },
            "access_mode": "public",
            "status": "closed",
        },
    )
    response = client.post(
        f"/api/forms/public/{form['slug']}/submit",
        json={"values": {"full_name": "X", "email": "x@example.com"}},
    )
    assert response.status_code in (400, 404)
