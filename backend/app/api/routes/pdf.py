from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_workspace_access
from app.database import get_db
from app.errors import not_found
from app.models import Document, GeneratedPdf, User, WorkspaceRole
from app.schemas import PdfGenerateIn, PdfOut
from app.services import documents as documents_service
from app.services import exports as exports_service
from app.services import storage
from app.services.rate_limit import export_limiter

router = APIRouter(prefix="/pdf", tags=["pdf"])


@router.post(
    "/documents/{document_id}",
    response_model=PdfOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(export_limiter)],
)
def generate_document_pdf(
    document_id: uuid.UUID,
    payload: PdfGenerateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PdfOut:
    document = db.get(Document, document_id)
    if document is None:
        raise not_found("Document not found")
    require_workspace_access(db, user, document.workspace_id, WorkspaceRole.editor)
    revision = documents_service.ensure_current_revision(db, document=document, user=user)
    return exports_service.generate_document_pdf(
        db,
        document=document,
        revision=revision,
        user=user,
        values=payload.values,
        filename=payload.filename,
    )


@router.get("/documents/{document_id}/exports", response_model=list[PdfOut])
def list_document_exports(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[GeneratedPdf]:
    document = db.get(Document, document_id)
    if document is None:
        raise not_found("Document not found")
    require_workspace_access(db, user, document.workspace_id)
    return list(
        db.scalars(
            select(GeneratedPdf)
            .where(GeneratedPdf.document_id == document.id)
            .order_by(GeneratedPdf.created_at.desc())
            .limit(50)
        )
    )


@router.get("/{pdf_id}/download")
def download_pdf(
    pdf_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileResponse:
    record = db.get(GeneratedPdf, pdf_id)
    if record is None:
        raise not_found("Export not found")
    require_workspace_access(db, user, record.workspace_id)
    path = storage.path_for(record.storage_key)
    if not path.exists():
        raise not_found("Export file missing from storage")
    return FileResponse(path, media_type="application/pdf", filename=record.filename)
