from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import bad_request, forbidden, not_found
from app.models import (
    Document,
    DocumentRevision,
    FormAccess,
    FormResponse,
    FormStatus,
    PublishedForm,
    User,
)
from app.security import hash_password, verify_password
from app.services.document_model import collect_fields, validate_submission


def _generate_slug(db: Session) -> str:
    for _ in range(6):
        slug = secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:10]
        if not db.scalar(select(PublishedForm).where(PublishedForm.slug == slug)):
            return slug
    raise bad_request("Could not allocate a form link, please retry")


def publish_form(
    db: Session,
    *,
    document: Document,
    revision: DocumentRevision,
    workspace_id: uuid.UUID,
    user: User,
    settings: dict[str, Any],
    access_mode: FormAccess,
    password: str | None,
    status: FormStatus = FormStatus.published,
) -> PublishedForm:
    closes_at = None
    if isinstance(settings.get("closesAt"), str) and settings["closesAt"]:
        try:
            closes_at = datetime.fromisoformat(settings["closesAt"].replace("Z", "+00:00"))
        except ValueError:
            closes_at = None

    existing = db.scalar(
        select(PublishedForm).where(
            PublishedForm.document_id == document.id,
            PublishedForm.status != FormStatus.closed,
        )
    )
    access_hash = hash_password(password) if access_mode == FormAccess.restricted and password else None
    if existing:
        existing.revision_id = revision.id
        existing.settings = settings
        existing.access_mode = access_mode
        existing.access_password_hash = access_hash
        existing.status = status
        existing.closes_at = closes_at
        db.commit()
        db.refresh(existing)
        return existing

    form = PublishedForm(
        document_id=document.id,
        revision_id=revision.id,
        workspace_id=workspace_id,
        created_by_id=user.id,
        slug=_generate_slug(db),
        status=status,
        access_mode=access_mode,
        access_password_hash=access_hash,
        settings=settings,
        closes_at=closes_at,
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return form


def list_forms(db: Session, workspace_id: uuid.UUID, limit: int = 200) -> list[PublishedForm]:
    stmt = (
        select(PublishedForm)
        .where(PublishedForm.workspace_id == workspace_id)
        .order_by(PublishedForm.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def get_form(db: Session, form_id: uuid.UUID) -> PublishedForm:
    form = db.get(PublishedForm, form_id)
    if form is None:
        raise not_found("Form not found")
    return form


def get_form_by_slug(db: Session, slug: str) -> PublishedForm:
    form = db.scalar(select(PublishedForm).where(PublishedForm.slug == slug))
    if form is None:
        raise not_found("Form not found")
    return form


def check_form_available(form: PublishedForm) -> None:
    if form.status == FormStatus.closed:
        raise bad_request("This form is closed")
    if form.status == FormStatus.draft:
        raise not_found("Form not available")
    if form.closes_at and form.closes_at < datetime.now(UTC):
        raise bad_request("This form has closed")


def authorize_access(form: PublishedForm, user: User | None, password: str | None) -> None:
    if form.access_mode == FormAccess.public:
        return
    if form.access_mode == FormAccess.authenticated:
        if user is None:
            raise forbidden("Sign in to complete this form")
        return
    if form.access_mode == FormAccess.restricted:
        if user is not None:
            return
        if (
            not password
            or not form.access_password_hash
            or not verify_password(password, form.access_password_hash)
        ):
            raise forbidden("A valid access password is required")


def form_fields(form: PublishedForm, revision: DocumentRevision) -> list[dict[str, Any]]:
    return collect_fields(revision.content.get("blocks", []))


def submit_response(
    db: Session,
    *,
    form: PublishedForm,
    revision: DocumentRevision,
    values: dict[str, Any],
    user: User | None,
    ip_hash: str,
    user_agent: str,
) -> FormResponse:
    check_form_available(form)
    fields = form_fields(form, revision)
    validation = validate_submission(fields, values)
    if not validation.ok:
        raise bad_request("Some answers need attention", {"fields": validation.errors})

    settings = form.settings or {}
    if not settings.get("allowMultiple", True) and user is not None:
        prior = db.scalar(
            select(FormResponse).where(
                FormResponse.form_id == form.id,
                FormResponse.submitted_by_id == user.id,
            )
        )
        if prior is not None:
            raise bad_request("You have already submitted this form")

    submitter_email = None
    if settings.get("collectEmail"):
        email_value = validation.cleaned.get("email")
        submitter_email = email_value if isinstance(email_value, str) else None

    response = FormResponse(
        form_id=form.id,
        revision_id=revision.id,
        submitted_by_id=user.id if user else None,
        submitter_email=submitter_email or (user.email if user else None),
        ip_hash=ip_hash,
        user_agent=user_agent[:500],
        data=validation.cleaned,
        status="received",
    )
    form.response_count = (form.response_count or 0) + 1
    db.add(response)
    db.commit()
    db.refresh(response)
    return response


def list_responses(db: Session, form_id: uuid.UUID, limit: int = 200) -> list[FormResponse]:
    stmt = (
        select(FormResponse)
        .where(FormResponse.form_id == form_id)
        .order_by(FormResponse.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def get_response(db: Session, response_id: uuid.UUID) -> FormResponse:
    response = db.get(FormResponse, response_id)
    if response is None:
        raise not_found("Response not found")
    return response
