from __future__ import annotations

import uuid

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError, forbidden, not_found
from app.models import Membership, User, Workspace, WorkspaceRole
from app.security import TokenError, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

ROLE_ORDER = {WorkspaceRole.viewer: 0, WorkspaceRole.editor: 1, WorkspaceRole.owner: 2}


def _unauthorized(message: str = "Authentication required") -> AppError:
    return AppError(401, "unauthorized", message)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise _unauthorized()
    try:
        payload = decode_access_token(credentials.credentials)
    except TokenError:
        raise _unauthorized("Session expired. Please sign in again.") from None
    subject = payload.get("sub")
    if not subject:
        raise _unauthorized()
    try:
        user_id = uuid.UUID(str(subject))
    except ValueError:
        raise _unauthorized() from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized("Account not found or disabled")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        return db.get(User, uuid.UUID(str(payload.get("sub"))))
    except (TokenError, ValueError):
        return None


def require_workspace_access(
    db: Session,
    user: User,
    workspace_id: uuid.UUID,
    minimum: WorkspaceRole = WorkspaceRole.viewer,
) -> Membership:
    membership = db.scalar(
        select(Membership).where(
            Membership.workspace_id == workspace_id,
            Membership.user_id == user.id,
        )
    )
    if membership is None:
        # Do not leak whether the workspace exists.
        raise forbidden()
    if ROLE_ORDER[membership.role] < ROLE_ORDER[minimum]:
        raise forbidden("Your role does not permit this action")
    return membership


def load_workspace(db: Session, workspace_id: uuid.UUID) -> Workspace:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise not_found("Workspace not found")
    return workspace


class WorkspaceAccess:
    """Dependency that resolves a workspace from a path parameter with a role check."""

    def __init__(self, minimum: WorkspaceRole = WorkspaceRole.viewer):
        self.minimum = minimum

    def __call__(
        self,
        workspace_id: uuid.UUID,
        request: Request,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> tuple[Workspace, Membership]:
        workspace = load_workspace(db, workspace_id)
        membership = require_workspace_access(db, user, workspace_id, self.minimum)
        request.state.workspace = workspace
        return workspace, membership
