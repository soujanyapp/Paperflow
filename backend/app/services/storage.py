from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path

from app.config import settings
from app.errors import bad_request

SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
}

EXTENSION_BY_TYPE = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
}


def storage_root() -> Path:
    root = Path(settings.storage_root)
    if not root.is_absolute():
        root = Path.cwd() / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_filename(name: str) -> str:
    cleaned = SAFE_NAME_RE.sub("_", name).strip("._") or "file"
    return cleaned[:200]


def validate_upload(content_type: str, size_bytes: int) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise bad_request(f"Unsupported file type: {content_type}")
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise bad_request(f"File exceeds the {settings.max_upload_mb} MB limit")


def save_bytes(*, category: str, filename: str, content: bytes, content_type: str) -> dict:
    validate_upload(content_type, len(content))
    checksum = hashlib.sha256(content).hexdigest()
    extension = Path(safe_filename(filename)).suffix or EXTENSION_BY_TYPE.get(content_type, "")
    key = f"{category}/{uuid.uuid4().hex}{extension}"
    path = storage_root() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return {"storage_key": key, "checksum": checksum, "size_bytes": len(content)}


def path_for(storage_key: str) -> Path:
    root = storage_root().resolve()
    path = (root / storage_key).resolve()
    if not str(path).startswith(str(root)):
        raise bad_request("Invalid storage key")
    return path


def read_bytes(storage_key: str) -> bytes:
    path = path_for(storage_key)
    if not path.exists():
        raise FileNotFoundError(storage_key)
    return path.read_bytes()


def delete(storage_key: str) -> None:
    try:
        path_for(storage_key).unlink(missing_ok=True)
    except OSError:
        pass


def to_data_uri(storage_key: str, content_type: str) -> str | None:
    try:
        data = read_bytes(storage_key)
    except FileNotFoundError:
        return None
    import base64

    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"
