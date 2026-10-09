from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user, require_workspace_access
from app.config import settings
from app.database import get_db
from app.errors import not_found
from app.models import (
    Document,
    DocumentRevision,
    FormAccess,
    FormResponse,
    FormStatus,
    PublishedForm,
    User,
    WorkspaceRole,
)
from app.schemas import (
    FormOut,
    FormPublishIn,
    PdfOut,
    PublicFormOut,
    ResponseOut,
    ResponseSubmitOut,
    SubmitIn,
)
from app.services import documents as documents_service
from app.services import exports as exports_service
from app.services import forms as forms_service
from app.services.rate_limit import export_limiter, public_submit_limiter

router = APIRouter(prefix="/forms", tags=["forms"])


def _hash_ip(ip: str) -> str:
    return hashlib.sha256(f"{ip}:{settings.secret_key}".encode()).hexdigest()


def _load_form_for_user(db: Session, user: User, form_id: uuid.UUID) -> PublishedForm:
    form = forms_service.get_form(db, form_id)
    require_workspace_access(db, user, form.workspace_id)
    return form


def _revision(db: Session, revision_id: uuid.UUID) -> DocumentRevision:
    revision = db.get(DocumentRevision, revision_id)
    if revision is None:
        raise not_found("Form revision not found")
    return revision


@router.post("/publish", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def publish_form(
    payload: FormPublishIn,
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PublishedForm:
    document = db.get(Document, document_id)
    if document is None:
        raise not_found("Document not found")
    require_workspace_access(db, user, document.workspace_id, WorkspaceRole.editor)

    if payload.revision_id is not None:
        revision = _revision(db, payload.revision_id)
        if revision.document_id != document.id:
            raise not_found("Revision does not belong to this document")
    else:
        revision = documents_service.ensure_current_revision(db, document=document, user=user)

    return forms_service.publish_form(
        db,
        document=document,
        revision=revision,
        workspace_id=document.workspace_id,
        user=user,
        settings=payload.settings.model_dump(),
        access_mode=FormAccess(payload.access_mode),
        password=payload.password,
        status=FormStatus(payload.status),
    )


@router.get("", response_model=list[FormOut])
def list_forms(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PublishedForm]:
    require_workspace_access(db, user, workspace_id)
    return forms_service.list_forms(db, workspace_id)


@router.get("/{form_id}", response_model=FormOut)
def get_form(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PublishedForm:
    return _load_form_for_user(db, user, form_id)


@router.get("/{form_id}/responses", response_model=list[ResponseOut])
def list_responses(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FormResponse]:
    form = _load_form_for_user(db, user, form_id)
    return forms_service.list_responses(db, form.id)


@router.post(
    "/{form_id}/responses/{response_id}/pdf",
    response_model=PdfOut,
    status_code=201,
    dependencies=[Depends(export_limiter)],
)
def generate_response_pdf(
    form_id: uuid.UUID,
    response_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PdfOut:
    form = _load_form_for_user(db, user, form_id)
    response = forms_service.get_response(db, response_id)
    if response.form_id != form.id:
        raise not_found("Response not found")
    return exports_service.generate_response_pdf(db, response=response, user=user)


@router.get("/public/{slug}", response_model=PublicFormOut)
def get_public_form(slug: str, db: Session = Depends(get_db)) -> PublicFormOut:
    form = forms_service.get_form_by_slug(db, slug)
    forms_service.check_form_available(form)
    revision = _revision(db, form.revision_id)
    document = db.get(Document, form.document_id)
    return PublicFormOut(
        slug=form.slug,
        status=form.status.value,
        access_mode=form.access_mode.value,
        settings=form.settings or {},
        document_title=document.title if document else "",
        fields=forms_service.form_fields(form, revision),
    )


@router.post(
    "/public/{slug}/submit",
    response_model=ResponseSubmitOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(public_submit_limiter)],
)
def submit_form(
    slug: str,
    payload: SubmitIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> ResponseSubmitOut:
    from app.services.rate_limit import client_ip

    form = forms_service.get_form_by_slug(db, slug)
    forms_service.authorize_access(form, user, payload.password)
    revision = _revision(db, form.revision_id)
    response = forms_service.submit_response(
        db,
        form=form,
        revision=revision,
        values=payload.values,
        user=user,
        ip_hash=_hash_ip(client_ip(request)),
        user_agent=request.headers.get("user-agent", ""),
    )
    settings_dict = form.settings or {}
    return ResponseSubmitOut(
        id=response.id,
        success_message=str(settings_dict.get("successMessage", "Thanks — your response has been recorded.")),
    )
