from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import bad_request, conflict
from app.models import Membership, User, Workspace, WorkspaceRole
from app.security import hash_password, verify_password

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "workspace"


def unique_workspace_slug(db: Session, base: str) -> str:
    slug = slugify(base)
    candidate = slug
    suffix = 1
    while db.scalar(select(Workspace).where(Workspace.slug == candidate)):
        suffix += 1
        candidate = f"{slug}-{suffix}"
    return candidate


def register_user(db: Session, *, email: str, password: str, full_name: str = "") -> tuple[User, Workspace]:
    email = normalize_email(email)
    if not EMAIL_RE.match(email):
        raise bad_request("Enter a valid email address")
    if len(password) < 8:
        raise bad_request("Password must be at least 8 characters")
    if db.scalar(select(User).where(User.email == email)):
        raise conflict("An account with that email already exists")

    user = User(email=email, password_hash=hash_password(password), full_name=full_name.strip())
    db.add(user)
    db.flush()

    workspace_name = f"{full_name.strip()}'s workspace" if full_name.strip() else "Personal workspace"
    workspace = Workspace(
        name=workspace_name,
        slug=unique_workspace_slug(db, workspace_name),
        owner_id=user.id,
        is_personal=True,
    )
    db.add(workspace)
    db.flush()
    db.add(Membership(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.owner))
    db.commit()
    db.refresh(user)
    db.refresh(workspace)
    return user, workspace


def authenticate(db: Session, *, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def ensure_personal_workspace(db: Session, user: User) -> Workspace:
    membership = db.scalar(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.role == WorkspaceRole.owner,
        )
    )
    if membership:
        return db.get(Workspace, membership.workspace_id)  # type: ignore[return-value]
    workspace = Workspace(
        name="Personal workspace",
        slug=unique_workspace_slug(db, f"personal-{secrets.token_hex(3)}"),
        owner_id=user.id,
        is_personal=True,
    )
    db.add(workspace)
    db.flush()
    db.add(Membership(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.owner))
    db.commit()
    db.refresh(workspace)
    return workspace
