from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.errors import AppError
from app.models import User
from app.schemas import LoginIn, RegisterIn, TokenOut, UserOut
from app.security import create_access_token
from app.services import auth as auth_service
from app.services.rate_limit import auth_limiter

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User, workspace) -> TokenOut:
    workspace_out = {
        "id": workspace.id,
        "name": workspace.name,
        "slug": workspace.slug,
        "is_personal": workspace.is_personal,
        "created_at": workspace.created_at,
        "role": "owner",
    }
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
        workspace=workspace_out,
    )


@router.post("/register", response_model=TokenOut, dependencies=[Depends(auth_limiter)])
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> TokenOut:
    user, workspace = auth_service.register_user(
        db, email=payload.email, password=payload.password, full_name=payload.full_name
    )
    return _token_response(user, workspace)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(auth_limiter)])
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = auth_service.authenticate(db, email=payload.email, password=payload.password)
    if user is None:
        raise AppError(401, "invalid_credentials", "Email or password is incorrect")
    workspace = auth_service.ensure_personal_workspace(db, user)
    return _token_response(user, workspace)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
