from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_workspace_access
from app.database import get_db
from app.errors import not_found
from app.models import Document, User, WorkspaceRole
from app.schemas import (
    DocumentCreateIn,
    DocumentOut,
    DocumentSummary,
    DocumentUpdateIn,
    RevisionOut,
    RevisionSummary,
)
from app.services import documents as documents_service

router = APIRouter(prefix="/documents", tags=["documents"])


def load_accessible_document(
    db: Session, user: User, document_id: uuid.UUID, minimum: WorkspaceRole = WorkspaceRole.viewer
) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise not_found("Document not found")
    require_workspace_access(db, user, document.workspace_id, minimum)
    return document


@router.get("", response_model=list[DocumentSummary])
def list_documents(
    workspace_id: uuid.UUID = Query(...),
    q: str | None = Query(default=None, max_length=200),
    folder_id: uuid.UUID | None = Query(default=None),
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Document]:
    require_workspace_access(db, user, workspace_id, WorkspaceRole.viewer)
    return documents_service.list_documents(
        db,
        workspace_id=workspace_id,
        search=q,
        folder_id=folder_id,
        include_archived=include_archived,
    )


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    workspace_id = payload.workspace_id
    if workspace_id is None:
        workspace_id = _default_workspace_id(db, user)
    require_workspace_access(db, user, workspace_id, WorkspaceRole.editor)
    from app.models import Workspace

    workspace = db.get(Workspace, workspace_id)
    assert workspace is not None
    return documents_service.create_document(
        db,
        workspace=workspace,
        user=user,
        title=payload.title,
        content=payload.content,
        folder_id=payload.folder_id,
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    return load_accessible_document(db, user, document_id)


@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    document = load_accessible_document(db, user, document_id, WorkspaceRole.editor)
    return documents_service.update_content(
        db,
        document=document,
        user=user,
        content=payload.content,
        expected_revision=payload.expected_revision,
        create_revision=payload.create_revision,
        label=payload.label,
    )


@router.post("/{document_id}/revisions", response_model=RevisionSummary, status_code=status.HTTP_201_CREATED)
def create_revision(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RevisionSummary:
    document = load_accessible_document(db, user, document_id, WorkspaceRole.editor)
    return documents_service.create_revision(db, document=document, user=user)


@router.get("/{document_id}/revisions", response_model=list[RevisionSummary])
def list_revisions(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    document = load_accessible_document(db, user, document_id)
    return documents_service.list_revisions(db, document.id)


@router.get("/{document_id}/revisions/{revision_id}", response_model=RevisionOut)
def get_revision(
    document_id: uuid.UUID,
    revision_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RevisionOut:
    document = load_accessible_document(db, user, document_id)
    return documents_service.get_revision(db, document.id, revision_id)


@router.post("/{document_id}/revisions/{revision_id}/restore", response_model=DocumentOut)
def restore_revision(
    document_id: uuid.UUID,
    revision_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    document = load_accessible_document(db, user, document_id, WorkspaceRole.editor)
    revision = documents_service.get_revision(db, document.id, revision_id)
    return documents_service.restore_revision(db, document=document, revision=revision, user=user)


@router.post("/{document_id}/duplicate", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def duplicate_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    document = load_accessible_document(db, user, document_id, WorkspaceRole.editor)
    return documents_service.duplicate_document(db, document=document, user=user)


@router.post("/{document_id}/archive", response_model=DocumentSummary)
def archive_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    document = load_accessible_document(db, user, document_id, WorkspaceRole.editor)
    document.is_archived = True
    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    document = load_accessible_document(db, user, document_id, WorkspaceRole.editor)
    db.delete(document)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _default_workspace_id(db: Session, user: User) -> uuid.UUID:
    from app.services.auth import ensure_personal_workspace

    return ensure_personal_workspace(db, user).id
