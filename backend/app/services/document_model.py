"""Server-side mirror of the frontend document model helpers.

Backend validation is authoritative: even though the editor validates too, the
API must never trust the client.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^[+()\-\s0-9]{6,}$")

NESTING_BLOCKS = {"section", "repeater"}


def collect_fields(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    def walk(items: list[dict[str, Any]]) -> None:
        for block in items:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "field" and isinstance(block.get("field"), dict):
                out.append(block["field"])
            elif block.get("type") in NESTING_BLOCKS:
                walk(block.get("blocks", []))

    walk(blocks or [])
    return out


def collect_asset_ids(blocks: list[dict[str, Any]]) -> list[str]:
    ids: list[str] = []

    def walk(items: list[dict[str, Any]]) -> None:
        for block in items:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "image" and block.get("assetId"):
                ids.append(block["assetId"])
            elif block.get("type") in NESTING_BLOCKS:
                walk(block.get("blocks", []))

    walk(blocks or [])
    return ids


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, tuple, dict)):
        return len(value) == 0
    return False


def condition_matches(condition: dict[str, Any] | None, values: dict[str, Any]) -> bool:
    if not condition:
        return True
    current = values.get(condition.get("fieldKey", ""))
    target = condition.get("value", "")
    operator = condition.get("operator", "equals")
    if operator == "equals":
        return str(current if current is not None else "") == str(target)
    if operator == "notEquals":
        return str(current if current is not None else "") != str(target)
    if operator == "contains":
        if isinstance(current, list):
            return str(target) in [str(v) for v in current]
        return str(target) in str(current if current is not None else "")
    if operator == "notEmpty":
        return not _is_blank(current)
    if operator == "isEmpty":
        return _is_blank(current)
    if operator == "gt":
        try:
            return float(current) > float(target)
        except (TypeError, ValueError):
            return False
    if operator == "lt":
        try:
            return float(current) < float(target)
        except (TypeError, ValueError):
            return False
    return True


@dataclass
class SubmissionValidation:
    ok: bool
    errors: dict[str, str] = field(default_factory=dict)
    cleaned: dict[str, Any] = field(default_factory=dict)


def validate_submission(fields: list[dict[str, Any]], values: dict[str, Any]) -> SubmissionValidation:
    errors: dict[str, str] = {}
    cleaned: dict[str, Any] = {}

    for field_def in fields:
        if not condition_matches(field_def.get("visibleWhen"), values):
            continue
        key = field_def.get("key", "")
        label = field_def.get("label", key)
        kind = field_def.get("kind")
        raw = values.get(key)

        if _is_blank(raw):
            if field_def.get("required"):
                errors[key] = f"{label} is required"
            continue

        validation = field_def.get("validation") or {}
        text = raw if isinstance(raw, str) else str(raw)

        if kind in {"shortText", "richText", "longText"}:
            min_length = validation.get("minLength")
            max_length = validation.get("maxLength")
            if min_length and len(text) < min_length:
                errors[key] = f"{label} must be at least {min_length} characters"
            if max_length and len(text) > max_length:
                errors[key] = f"{label} must be at most {max_length} characters"
            pattern = validation.get("pattern")
            if pattern:
                try:
                    if not re.search(pattern, text):
                        errors[key] = validation.get("patternMessage") or f"{label} has an invalid format"
                except re.error:
                    pass
            cleaned[key] = text
        elif kind == "email":
            if not EMAIL_RE.match(text.strip()):
                errors[key] = "Enter a valid email address"
            cleaned[key] = text.strip()
        elif kind == "phone":
            if not PHONE_RE.match(text.strip()):
                errors[key] = "Enter a valid phone number"
            cleaned[key] = text.strip()
        elif kind == "number":
            try:
                number = float(raw)
            except (TypeError, ValueError):
                errors[key] = "Enter a valid number"
            else:
                minimum = validation.get("min")
                maximum = validation.get("max")
                if minimum is not None and number < minimum:
                    errors[key] = f"{label} must be at least {minimum}"
                if maximum is not None and number > maximum:
                    errors[key] = f"{label} must be at most {maximum}"
                cleaned[key] = number
        elif kind == "date":
            cleaned[key] = text
        elif kind in {"dropdown", "radio"}:
            allowed = {opt.get("value") for opt in field_def.get("options", [])}
            if allowed and text not in allowed:
                errors[key] = "Choose one of the listed options"
            cleaned[key] = text
        elif kind == "checkbox":
            arr = raw if isinstance(raw, list) else [raw]
            arr = [str(v) for v in arr]
            allowed = {opt.get("value") for opt in field_def.get("options", [])}
            cleaned[key] = [v for v in arr if v in allowed] if allowed else arr
        elif kind in {"file", "signature"}:
            cleaned[key] = raw
        else:
            cleaned[key] = raw

    return SubmissionValidation(ok=not errors, errors=errors, cleaned=cleaned)


def sanitize_document(document: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of the document with all rich-text HTML sanitized.

    Structural validation is intentionally light (the editor owns shape); the
    security-relevant work here is stripping scripts/event handlers from every
    HTML fragment before it is persisted.
    """
    from copy import deepcopy

    from app.services.tokens import sanitize_html

    clone = deepcopy(document)

    def walk(blocks: list[dict[str, Any]]) -> None:
        for block in blocks:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "paragraph" and isinstance(block.get("html"), str):
                block["html"] = sanitize_html(block["html"])
            elif btype == "table":
                for row in block.get("rows", []) or []:
                    for cell in row or []:
                        if isinstance(cell, dict) and isinstance(cell.get("html"), str):
                            cell["html"] = sanitize_html(cell["html"])
            elif btype in NESTING_BLOCKS:
                walk(block.get("blocks", []) or [])

    walk(clone.get("blocks", []) or [])
    header = clone.get("header")
    if isinstance(header, dict):
        walk(header.get("blocks", []) or [])
    footer = clone.get("footer")
    if isinstance(footer, dict):
        walk(footer.get("blocks", []) or [])
    return clone


def validate_document_structure(document: Any) -> None:
    from app.errors import bad_request

    if not isinstance(document, dict):
        raise bad_request("Document content must be a JSON object")
    if not isinstance(document.get("blocks"), list):
        raise bad_request("Document content must include a blocks array")
    if not isinstance(document.get("page"), dict):
        raise bad_request("Document content must include page settings")
    if len(document.get("blocks", [])) > 5000:
        raise bad_request("Document exceeds the maximum block count")


def document_field_keys(document: dict[str, Any]) -> list[str]:
    return [f.get("key", "") for f in collect_fields(document.get("blocks", []))]


def resolve_repeaters(document: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
    """Assemble repeater item values from a flat submission if provided.

    Responses may include ``__repeater__<blockId>`` arrays; they are passed
    through unchanged so the renderer can expand them.
    """
    return values
