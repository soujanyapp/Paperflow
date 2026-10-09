import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamped, UuidPrimaryKey


class FormStatus(enum.StrEnum):
    draft = "draft"
    published = "published"
    closed = "closed"


class FormAccess(enum.StrEnum):
    public = "public"
    authenticated = "authenticated"
    restricted = "restricted"


class PublishedForm(UuidPrimaryKey, Timestamped, Base):
    __tablename__ = "published_forms"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The exact revision rendered for respondents & personalized PDFs.
    revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("document_revisions.id", ondelete="RESTRICT"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    status: Mapped[FormStatus] = mapped_column(
        Enum(FormStatus, name="form_status"), default=FormStatus.draft, nullable=False
    )
    access_mode: Mapped[FormAccess] = mapped_column(
        Enum(FormAccess, name="form_access"), default=FormAccess.public, nullable=False
    )
    access_password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    response_count: Mapped[int] = mapped_column(default=0, nullable=False)

    responses: Mapped[list["FormResponse"]] = relationship(
        back_populates="form", cascade="all, delete-orphan"
    )


class FormResponse(UuidPrimaryKey, Timestamped, Base):
    __tablename__ = "form_responses"

    form_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("published_forms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("document_revisions.id", ondelete="RESTRICT"), nullable=False
    )
    submitted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    submitter_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    ip_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    user_agent: Mapped[str] = mapped_column(Text, default="", nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="received", nullable=False)

    form: Mapped[PublishedForm] = relationship(back_populates="responses")
