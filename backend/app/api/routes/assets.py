from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_workspace_access
from app.database import get_db
from app.errors import bad_request, not_found
from app.models import Asset, Document, User, WorkspaceRole
from app.schemas import AssetOut
from app.services import storage

router = APIRouter(prefix="/assets", tags=["assets"])

MAX_ASSET_BYTES = 25 * 1024 * 1024


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    workspace_id: uuid.UUID = Form(...),
    document_id: uuid.UUID | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Asset:
    require_workspace_access(db, user, workspace_id, WorkspaceRole.editor)
    if document_id is not None:
        document = db.get(Document, document_id)
        if document is None or document.workspace_id != workspace_id:
            raise not_found("Document not found")

    content = await file.read()
    if len(content) > MAX_ASSET_BYTES:
        raise bad_request("File is too large")
    content_type = file.content_type or "application/octet-stream"
    saved = storage.save_bytes(
        category="assets",
        filename=file.filename or "upload",
        content=content,
        content_type=content_type,
    )
    asset = Asset(
        workspace_id=workspace_id,
        document_id=document_id,
        created_by_id=user.id,
        filename=storage.safe_filename(file.filename or "upload"),
        content_type=content_type,
        size_bytes=saved["size_bytes"],
        storage_key=saved["storage_key"],
        checksum=saved["checksum"],
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise not_found("Asset not found")
    require_workspace_access(db, user, asset.workspace_id)
    return asset


@router.get("/{asset_id}/download")
def download_asset(
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FileResponse:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise not_found("Asset not found")
    require_workspace_access(db, user, asset.workspace_id)
    path = storage.path_for(asset.storage_key)
    if not path.exists():
        raise not_found("Asset file missing from storage")
    return FileResponse(path, media_type=asset.content_type, filename=asset.filename)
