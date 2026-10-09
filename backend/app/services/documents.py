from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.errors import conflict, not_found
from app.models import Document, DocumentRevision, Folder, User, Workspace
from app.services.document_model import sanitize_document, validate_document_structure


def _snapshot(
    db: Session, document: Document, user: User | None, label: str, number: int
) -> DocumentRevision:
    revision = DocumentRevision(
        document_id=document.id,
        revision_number=number,
        content=document.content,
        label=label,
        created_by_id=user.id if user else None,
    )
    db.add(revision)
    return revision


def create_document(
    db: Session,
    *,
    workspace: Workspace,
    user: User,
    title: str,
    content: dict[str, Any],
    folder_id: uuid.UUID | None = None,
) -> Document:
    validate_document_structure(content)
    clean = sanitize_document(content)
    document = Document(
        workspace_id=workspace.id,
        folder_id=folder_id,
        created_by_id=user.id,
        title=title.strip()[:300] or "Untitled document",
        content=clean,
        revision=1,
        page_size=str(clean.get("page", {}).get("size", "A4")),
        orientation=str(clean.get("page", {}).get("orientation", "portrait")),
        layout=str(clean.get("layout", "flow")),
    )
    db.add(document)
    db.flush()
    _snapshot(db, document, user, "Initial version", 1)
    db.commit()
    db.refresh(document)
    return document


def list_documents(
    db: Session,
    *,
    workspace_id: uuid.UUID,
    search: str | None = None,
    folder_id: uuid.UUID | None = None,
    include_archived: bool = False,
) -> list[Document]:
    stmt = select(Document).where(Document.workspace_id == workspace_id)
    if not include_archived:
        stmt = stmt.where(Document.is_archived.is_(False))
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Document.title.ilike(like), Document.content["title"].astext.ilike(like)))
    if folder_id:
        stmt = stmt.where(Document.folder_id == folder_id)
    stmt = stmt.order_by(Document.updated_at.desc())
    return list(db.scalars(stmt))


def update_content(
    db: Session,
    *,
    document: Document,
    user: User,
    content: dict[str, Any],
    expected_revision: int | None,
    create_revision: bool = False,
    label: str = "",
) -> Document:
    validate_document_structure(content)
    if expected_revision is not None and expected_revision != document.revision:
        raise conflict("This document was changed elsewhere. Reload to get the latest version.")
    if content == document.content:
        return document
    document.content = sanitize_document(content)
    document.title = str(document.content.get("title", document.title))[:300] or document.title
    document.page_size = str(document.content.get("page", {}).get("size", document.page_size))
    document.orientation = str(document.content.get("page", {}).get("orientation", document.orientation))
    document.layout = str(document.content.get("layout", document.layout))
    document.revision += 1
    if create_revision:
        _snapshot(db, document, user, label or f"Version {document.revision}", document.revision)
    db.commit()
    db.refresh(document)
    return document


def ensure_current_revision(db: Session, *, document: Document, user: User | None = None) -> DocumentRevision:
    """Return a revision matching the document's current content.

    Autosave updates ``document.content`` without creating a snapshot, so the most
    recent snapshot can lag behind. Export/publish call this to materialize a
    revision that is guaranteed to match what the user currently sees.
    """
    latest = db.scalar(
        select(DocumentRevision)
        .where(DocumentRevision.document_id == document.id)
        .order_by(DocumentRevision.revision_number.desc())
        .limit(1)
    )
    if (
        latest is not None
        and latest.revision_number == document.revision
        and latest.content == document.content
    ):
        return latest
    revision = _snapshot(db, document, user, f"Version {document.revision}", document.revision)
    db.commit()
    db.refresh(revision)
    return revision


def get_document(db: Session, document_id: uuid.UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise not_found("Document not found")
    return document


def create_revision(db: Session, *, document: Document, user: User, label: str = "") -> DocumentRevision:
    revision = _snapshot(db, document, user, label or f"Version {document.revision}", document.revision)
    db.commit()
    db.refresh(revision)
    return revision


def list_revisions(db: Session, document_id: uuid.UUID, limit: int = 50) -> list[DocumentRevision]:
    stmt = (
        select(DocumentRevision)
        .where(DocumentRevision.document_id == document_id)
        .order_by(DocumentRevision.revision_number.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def get_revision(db: Session, document_id: uuid.UUID, revision_id: uuid.UUID) -> DocumentRevision:
    revision = db.get(DocumentRevision, revision_id)
    if revision is None or revision.document_id != document_id:
        raise not_found("Revision not found")
    return revision


def restore_revision(db: Session, *, document: Document, revision: DocumentRevision, user: User) -> Document:
    document.content = revision.content
    document.title = str(revision.content.get("title", document.title))[:300] or document.title
    document.revision += 1
    _snapshot(db, document, user, f"Restored version {revision.revision_number}", document.revision)
    db.commit()
    db.refresh(document)
    return document


def duplicate_document(db: Session, *, document: Document, user: User) -> Document:
    clone = Document(
        workspace_id=document.workspace_id,
        folder_id=document.folder_id,
        created_by_id=user.id,
        title=f"{document.title} (copy)",
        content=document.content,
        revision=1,
        page_size=document.page_size,
        orientation=document.orientation,
        layout=document.layout,
    )
    db.add(clone)
    db.flush()
    _snapshot(db, clone, user, "Initial version", 1)
    db.commit()
    db.refresh(clone)
    return clone


def create_folder(db: Session, *, workspace_id: uuid.UUID, name: str, parent_id: uuid.UUID | None) -> Folder:
    folder = Folder(workspace_id=workspace_id, name=name.strip()[:200] or "Folder", parent_id=parent_id)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


def list_folders(db: Session, workspace_id: uuid.UUID) -> list[Folder]:
    return list(
        db.scalars(select(Folder).where(Folder.workspace_id == workspace_id).order_by(Folder.name.asc()))
    )
