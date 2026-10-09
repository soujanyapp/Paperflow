from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app import models  # noqa: F401  (ensures all tables are registered)
from app.api.router import api_router
from app.config import settings
from app.database import SessionLocal, engine
from app.errors import register_exception_handlers
from app.models import Base, Template
from app.services.seed import build_system_templates


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)


def seed_system_templates() -> None:
    with SessionLocal() as db:
        existing = db.scalar(select(Template).where(Template.is_system.is_(True)).limit(1))
        if existing:
            return
        for entry in build_system_templates():
            db.add(
                Template(
                    workspace_id=None,
                    created_by_id=None,
                    name=entry["name"],
                    description=entry["description"],
                    category=entry["category"],
                    thumbnail="",
                    content=entry["content"],
                    is_system=True,
                )
            )
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.is_production:
        ensure_schema()
        seed_system_templates()
    yield


app = FastAPI(
    title="Paperflow API",
    version="0.1.0",
    description="Documents, forms, and PDF export for the Paperflow studio.",
    lifespan=lifespan,
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.env}


app.include_router(api_router)
