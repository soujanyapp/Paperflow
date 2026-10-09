from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.errors import AppError, not_found
from app.models import Asset, Document, DocumentRevision, FormResponse, GeneratedPdf, PublishedForm, User
from app.services import storage
from app.services.pdf import PdfExportError, render_to_pdf


def build_asset_resolver(db: Session, workspace_id: uuid.UUID):
    def resolve(asset_id: str) -> str | None:
        try:
            asset_uuid = uuid.UUID(asset_id)
        except (ValueError, AttributeError):
            return None
        asset = db.get(Asset, asset_uuid)
        if asset is None or asset.workspace_id != workspace_id:
            return None
        return storage.to_data_uri(asset.storage_key, asset.content_type)

    return resolve


def _persist_pdf(
    db: Session,
    *,
    document: Document,
    revision: DocumentRevision,
    workspace_id: uuid.UUID,
    user: User | None,
    content: bytes,
    page_count: int,
    filename: str,
    response_id: uuid.UUID | None = None,
) -> GeneratedPdf:
    saved = storage.save_bytes(
        category="pdfs", filename=filename, content=content, content_type="application/pdf"
    )
    record = GeneratedPdf(
        workspace_id=workspace_id,
        document_id=document.id,
        revision_id=revision.id,
        response_id=response_id,
        created_by_id=user.id if user else None,
        storage_key=saved["storage_key"],
        filename=filename,
        page_count=page_count,
        size_bytes=saved["size_bytes"],
        checksum=saved["checksum"],
        status="ready",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def generate_document_pdf(
    db: Session,
    *,
    document: Document,
    revision: DocumentRevision,
    user: User | None,
    values: dict[str, Any] | None = None,
    filename: str | None = None,
    asset_ids: list[str] | None = None,
) -> GeneratedPdf:
    resolver = build_asset_resolver(db, document.workspace_id)
    if asset_ids:
        for asset_id in asset_ids:
            resolver(asset_id)
    try:
        page_count, content = _render_bytes(revision.content, values or {}, resolver)
    except PdfExportError as exc:
        raise AppError(500, "pdf_export_failed", str(exc)) from exc

    name = filename or f"{_slug(document.title)}.pdf"
    return _persist_pdf(
        db,
        document=document,
        revision=revision,
        workspace_id=document.workspace_id,
        user=user,
        content=content,
        page_count=page_count,
        filename=name,
    )


def generate_response_pdf(
    db: Session,
    *,
    response: FormResponse,
    user: User | None,
) -> GeneratedPdf:
    form = db.get(PublishedForm, response.form_id)
    if form is None:
        raise not_found("Form not found")
    document = db.get(Document, form.document_id)
    revision = db.get(DocumentRevision, response.revision_id)
    if document is None or revision is None:
        raise not_found("Source document revision not found")

    resolver = build_asset_resolver(db, form.workspace_id)
    values = dict(response.data or {})
    try:
        page_count, content = _render_bytes(revision.content, values, resolver)
    except PdfExportError as exc:
        raise AppError(500, "pdf_export_failed", str(exc)) from exc

    name = f"{_slug(document.title)}-{str(response.id)[:8]}.pdf"
    return _persist_pdf(
        db,
        document=document,
        revision=revision,
        workspace_id=form.workspace_id,
        user=user,
        content=content,
        page_count=page_count,
        filename=name,
        response_id=response.id,
    )


def _render_bytes(document_content: dict[str, Any], values: dict[str, Any], resolver) -> tuple[int, bytes]:
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "export.pdf"
        page_count = render_to_pdf(document_content, path, values=values, asset_url=resolver)
        return page_count, path.read_bytes()


def _slug(value: str) -> str:
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "document"
