from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models import Membership, User, Workspace, WorkspaceRole
from app.schemas import FolderCreateIn, FolderOut, MembershipOut, WorkspaceCreateIn, WorkspaceOut
from app.services import auth as auth_service
from app.services import documents as documents_service

router = APIRouter(tags=["workspaces"])


def _workspace_out(workspace: Workspace, role: WorkspaceRole) -> WorkspaceOut:
    return WorkspaceOut(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        is_personal=workspace.is_personal,
        created_at=workspace.created_at,
        role=role.value,
    )


@router.get("/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[WorkspaceOut]:
    memberships = db.scalars(select(Membership).where(Membership.user_id == user.id)).all()
    out: list[WorkspaceOut] = []
    for membership in memberships:
        workspace = db.get(Workspace, membership.workspace_id)
        if workspace:
            out.append(_workspace_out(workspace, membership.role))
    if not out:
        workspace = auth_service.ensure_personal_workspace(db, user)
        out.append(_workspace_out(workspace, WorkspaceRole.owner))
    return out


@router.post("/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = Workspace(
        name=payload.name.strip(),
        slug=auth_service.unique_workspace_slug(db, payload.name),
        owner_id=user.id,
        is_personal=False,
    )
    db.add(workspace)
    db.flush()
    db.add(Membership(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.owner))
    db.commit()
    db.refresh(workspace)
    return _workspace_out(workspace, WorkspaceRole.owner)


@router.get("/workspaces/{workspace_id}/members", response_model=list[MembershipOut])
def list_members(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MembershipOut]:
    from app.api.deps import require_workspace_access

    require_workspace_access(db, user, workspace_id)
    memberships = db.scalars(select(Membership).where(Membership.workspace_id == workspace_id)).all()
    out: list[MembershipOut] = []
    for membership in memberships:
        member = db.get(User, membership.user_id)
        out.append(
            MembershipOut(
                id=membership.id,
                user_id=membership.user_id,
                role=membership.role.value,
                email=member.email if member else None,
                full_name=member.full_name if member else None,
            )
        )
    return out


@router.get("/folders", response_model=list[FolderOut])
def list_folders(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FolderOut]:
    from app.api.deps import require_workspace_access

    require_workspace_access(db, user, workspace_id)
    return documents_service.list_folders(db, workspace_id)


@router.post("/folders", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    workspace_id: uuid.UUID,
    payload: FolderCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FolderOut:
    from app.api.deps import require_workspace_access

    require_workspace_access(db, user, workspace_id, WorkspaceRole.editor)
    return documents_service.create_folder(
        db, workspace_id=workspace_id, name=payload.name, parent_id=payload.parent_id
    )
