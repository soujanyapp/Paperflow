import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamped, UuidPrimaryKey


class Folder(UuidPrimaryKey, Timestamped, Base):
    __tablename__ = "folders"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("folders.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    documents: Mapped[list["Document"]] = relationship(back_populates="folder")


class Document(UuidPrimaryKey, Timestamped, Base):
    __tablename__ = "documents"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(300), default="Untitled document", nullable=False)
    # Canonical Paperflow document JSON (see frontend src/document/types.ts).
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    page_size: Mapped[str] = mapped_column(String(16), default="A4", nullable=False)
    orientation: Mapped[str] = mapped_column(String(16), default="portrait", nullable=False)
    layout: Mapped[str] = mapped_column(String(16), default="flow", nullable=False)
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False)

    folder: Mapped[Folder | None] = relationship(back_populates="documents")
    revisions: Mapped[list["DocumentRevision"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentRevision.revision_number.desc()",
    )


class DocumentRevision(UuidPrimaryKey, Timestamped, Base):
    __tablename__ = "document_revisions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    label: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    document: Mapped[Document] = relationship(back_populates="revisions")


class Template(UuidPrimaryKey, Timestamped, Base):
    __tablename__ = "templates"

    # System templates have no workspace; workspace templates are private.
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="general", nullable=False, index=True)
    thumbnail: Mapped[str] = mapped_column(Text, default="", nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_system: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
