from __future__ import annotations

from typing import Any


def para(html: str, block_id: str = "p") -> dict[str, Any]:
    return {"id": block_id, "type": "paragraph", "html": html}


def page_break(block_id: str = "pb") -> dict[str, Any]:
    return {"id": block_id, "type": "pageBreak"}


def heading(text: str, block_id: str = "h") -> dict[str, Any]:
    return {"id": block_id, "type": "heading", "level": 1, "text": text}


def field(key: str, label: str, kind: str, required: bool = False, block_id: str = "f") -> dict[str, Any]:
    return {
        "id": block_id,
        "type": "field",
        "field": {"key": key, "label": label, "kind": kind, "required": required},
    }


def document_content(
    title: str = "Test document",
    blocks: list[dict[str, Any]] | None = None,
    page: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "id": "doc_test",
        "title": title,
        "layout": "flow",
        "page": page
        or {
            "size": "A4",
            "orientation": "portrait",
            "margins": {"top": 20, "right": 18, "bottom": 20, "left": 18},
            "background": "#ffffff",
        },
        "theme": {
            "id": "editorial",
            "name": "Editorial",
            "headingFont": "Source Serif 4",
            "bodyFont": "Source Serif 4",
            "accentColor": "#2547d0",
            "textColor": "#1a1b20",
            "baseFontSize": 11,
            "lineHeight": 1.5,
        },
        "header": {"enabled": False, "blocks": []},
        "footer": {"enabled": False, "blocks": []},
        "pageNumber": {
            "enabled": False,
            "format": "n",
            "align": "center",
            "startAt": 1,
            "hideOnFirst": False,
        },
        "blocks": blocks if blocks is not None else [para("<p>Hello</p>")],
        "meta": {"createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z"},
    }
