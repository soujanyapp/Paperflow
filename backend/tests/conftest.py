import os
import tempfile
from collections.abc import Iterator

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://paperflow:paperflow_dev@localhost:5432/paperflow_test",
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-123456")
os.environ["STORAGE_ROOT"] = tempfile.mkdtemp(prefix="paperflow-test-storage-")
os.environ.setdefault("PAPERFLOW_ENV", "test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import models  # noqa: E402, F401
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.services.seed import build_system_templates  # noqa: E402

MUTABLE_TABLES = [
    "generated_pdfs",
    "form_responses",
    "published_forms",
    "assets",
    "document_revisions",
    "documents",
    "folders",
    "memberships",
    "workspaces",
    "users",
]


@pytest.fixture(scope="session", autouse=True)
def _schema() -> Iterator[None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        from app.models import Template

        db.query(Template).delete()
        for entry in build_system_templates():
            db.add(
                Template(
                    name=entry["name"],
                    description=entry["description"],
                    category=entry["category"],
                    content=entry["content"],
                    is_system=True,
                )
            )
        db.commit()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _clean_tables() -> Iterator[None]:
    yield
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {', '.join(MUTABLE_TABLES)} RESTART IDENTITY CASCADE"))


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth(client: TestClient) -> dict:
    response = client.post(
        "/api/auth/register",
        json={"email": "writer@example.com", "password": "supersecret", "full_name": "Writer"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    return {
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
        "workspace_id": body["workspace"]["id"],
        "user": body["user"],
    }


def make_document(client: TestClient, auth: dict, content: dict) -> dict:
    response = client.post(
        "/api/documents",
        headers=auth["headers"],
        json={
            "title": content.get("title", "Test"),
            "content": content,
            "workspace_id": auth["workspace_id"],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
