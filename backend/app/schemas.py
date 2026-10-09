from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth & identity --------------------------------------------------------


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    full_name: str = Field(default="", max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(ORMModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime


class WorkspaceOut(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    is_personal: bool
    created_at: datetime
    role: str | None = None


class MembershipOut(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    email: str | None = None
    full_name: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    workspace: WorkspaceOut


class WorkspaceCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


# --- Documents --------------------------------------------------------------


class DocumentSummary(ORMModel):
    id: uuid.UUID
    title: str
    revision: int
    page_size: str
    orientation: str
    layout: str
    is_archived: bool
    folder_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class DocumentOut(DocumentSummary):
    workspace_id: uuid.UUID
    content: dict[str, Any]


class DocumentCreateIn(BaseModel):
    title: str = Field(default="Untitled document", max_length=300)
    content: dict[str, Any]
    folder_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None


class DocumentUpdateIn(BaseModel):
    content: dict[str, Any]
    expected_revision: int | None = None
    create_revision: bool = False
    label: str = Field(default="", max_length=200)


class RevisionSummary(ORMModel):
    id: uuid.UUID
    revision_number: int
    label: str
    created_at: datetime
    created_by_id: uuid.UUID | None


class RevisionOut(RevisionSummary):
    content: dict[str, Any]


class FolderOut(ORMModel):
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    created_at: datetime


class FolderCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: uuid.UUID | None = None


class TemplateOut(ORMModel):
    id: uuid.UUID
    name: str
    description: str
    category: str
    thumbnail: str
    is_system: bool
    content: dict[str, Any]


class TemplateCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="general", max_length=80)
    thumbnail: str = Field(default="", max_length=500_000)
    content: dict[str, Any]


class AssetOut(ORMModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    checksum: str
    created_at: datetime


# --- Forms ------------------------------------------------------------------


class FormSettingsIn(BaseModel):
    title: str = Field(default="Untitled form", max_length=300)
    description: str = Field(default="", max_length=4000)
    submitLabel: str = Field(default="Submit", max_length=80)
    successMessage: str = Field(default="Thanks — your response has been recorded.", max_length=1000)
    allowMultiple: bool = True
    requireAuth: bool = False
    collectEmail: bool = False
    closesAt: str | None = None


class FormPublishIn(BaseModel):
    settings: FormSettingsIn
    access_mode: str = Field(default="public", pattern="^(public|authenticated|restricted)$")
    password: str | None = Field(default=None, max_length=200)
    status: str = Field(default="published", pattern="^(draft|published|closed)$")
    revision_id: uuid.UUID | None = None


class FormOut(ORMModel):
    id: uuid.UUID
    document_id: uuid.UUID
    revision_id: uuid.UUID
    slug: str
    status: str
    access_mode: str
    settings: dict[str, Any]
    response_count: int
    closes_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PublicFormOut(BaseModel):
    slug: str
    status: str
    access_mode: str
    settings: dict[str, Any]
    document_title: str
    fields: list[dict[str, Any]]


class SubmitIn(BaseModel):
    values: dict[str, Any]
    email: EmailStr | None = None
    password: str | None = None


class ResponseOut(ORMModel):
    id: uuid.UUID
    form_id: uuid.UUID
    revision_id: uuid.UUID
    submitter_email: str | None
    data: dict[str, Any]
    status: str
    created_at: datetime


class ResponseSubmitOut(BaseModel):
    id: uuid.UUID
    success_message: str


# --- PDFs -------------------------------------------------------------------


class PdfOut(ORMModel):
    id: uuid.UUID
    document_id: uuid.UUID
    revision_id: uuid.UUID
    response_id: uuid.UUID | None
    filename: str
    page_count: int
    size_bytes: int
    status: str
    created_at: datetime


class PdfGenerateIn(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)
    filename: str | None = Field(default=None, max_length=200)
