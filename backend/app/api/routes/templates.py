from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_workspace_access
from app.database import get_db
from app.errors import not_found
from app.models import Membership, Template, User, WorkspaceRole
from app.schemas import DocumentOut, TemplateCreateIn, TemplateOut
from app.services import documents as documents_service


def _accessible_workspace_ids(db: Session, user: User) -> list[uuid.UUID]:
    return [m.workspace_id for m in db.scalars(select(Membership).where(Membership.user_id == user.id)).all()]


router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(
    category: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Template]:
    workspace_ids = _accessible_workspace_ids(db, user)
    stmt = select(Template).where(or_(Template.is_system.is_(True), Template.workspace_id.in_(workspace_ids)))
    if category and category != "all":
        stmt = stmt.where(Template.category == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Template.name.ilike(like), Template.description.ilike(like)))
    stmt = stmt.order_by(Template.is_system.desc(), Template.name.asc())
    return list(db.scalars(stmt))


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Template:
    template = db.get(Template, template_id)
    if template is None:
        raise not_found("Template not found")
    if not template.is_system and template.workspace_id not in _accessible_workspace_ids(db, user):
        raise not_found("Template not found")
    return template


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    workspace_id: uuid.UUID,
    payload: TemplateCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Template:
    require_workspace_access(db, user, workspace_id, WorkspaceRole.editor)
    template = Template(
        workspace_id=workspace_id,
        created_by_id=user.id,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        thumbnail=payload.thumbnail,
        content=payload.content,
        is_system=False,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.post("/{template_id}/use", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def use_template(
    template_id: uuid.UUID,
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    template = get_template(template_id, db, user)
    require_workspace_access(db, user, workspace_id, WorkspaceRole.editor)
    from app.models import Workspace

    workspace = db.get(Workspace, workspace_id)
    assert workspace is not None
    document = documents_service.create_document(
        db,
        workspace=workspace,
        user=user,
        title=template.name,
        content=template.content,
    )
    return document
