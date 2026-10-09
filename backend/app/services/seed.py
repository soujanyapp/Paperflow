"""System template library.

Definitions are plain Paperflow document JSON so they flow through the exact
same validation, preview, and export pipeline as user documents.
"""

from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

THEMES: dict[str, dict[str, Any]] = {
    "editorial": {
        "id": "editorial",
        "name": "Editorial",
        "headingFont": "Source Serif 4",
        "bodyFont": "Source Serif 4",
        "accentColor": "#2547d0",
        "textColor": "#1a1b20",
        "baseFontSize": 11,
        "lineHeight": 1.5,
    },
    "modern": {
        "id": "modern",
        "name": "Modern",
        "headingFont": "Hanken Grotesk",
        "bodyFont": "Hanken Grotesk",
        "accentColor": "#0f766e",
        "textColor": "#14161a",
        "baseFontSize": 10.5,
        "lineHeight": 1.6,
    },
    "classic": {
        "id": "classic",
        "name": "Classic",
        "headingFont": "Georgia",
        "bodyFont": "Georgia",
        "accentColor": "#7c2d12",
        "textColor": "#1c1917",
        "baseFontSize": 11,
        "lineHeight": 1.55,
    },
}


def _id() -> str:
    return f"blk_{uuid.uuid4().hex[:16]}"


def heading(text: str, level: int = 1) -> dict[str, Any]:
    return {"id": _id(), "type": "heading", "level": level, "text": text}


def paragraph(html: str) -> dict[str, Any]:
    return {"id": _id(), "type": "paragraph", "html": html}


def spacer(height: float = 8) -> dict[str, Any]:
    return {"id": _id(), "type": "spacer", "height": height}


def divider() -> dict[str, Any]:
    return {"id": _id(), "type": "divider"}


def signature(label: str = "Signature") -> dict[str, Any]:
    return {"id": _id(), "type": "signature", "label": label, "mode": "blank"}


def table(columns: list[int], rows: list[list[str]], header_row: bool = True) -> dict[str, Any]:
    return {
        "id": _id(),
        "type": "table",
        "headerRow": header_row,
        "columns": [{"width": w} for w in columns],
        "rows": [[{"html": cell} for cell in row] for row in rows],
    }


def field(
    key: str,
    label: str,
    kind: str,
    *,
    required: bool = False,
    options: list[str] | None = None,
    placeholder: str = "",
) -> dict[str, Any]:
    definition: dict[str, Any] = {"key": key, "label": label, "kind": kind, "required": required}
    if placeholder:
        definition["placeholder"] = placeholder
    if options:
        definition["options"] = [{"value": o.lower().replace(" ", "_"), "label": o} for o in options]
    return {"id": _id(), "type": "field", "field": definition}


def document(title: str, blocks: list[dict[str, Any]], theme: str = "editorial") -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    return {
        "schemaVersion": 1,
        "id": f"doc_{uuid.uuid4().hex[:16]}",
        "title": title,
        "layout": "flow",
        "page": {
            "size": "A4",
            "orientation": "portrait",
            "margins": {"top": 20, "right": 18, "bottom": 20, "left": 18},
            "background": "#ffffff",
        },
        "theme": deepcopy(THEMES[theme]),
        "header": {"enabled": False, "blocks": []},
        "footer": {"enabled": False, "blocks": []},
        "pageNumber": {
            "enabled": False,
            "format": "n",
            "align": "center",
            "startAt": 1,
            "hideOnFirst": False,
        },
        "blocks": blocks,
        "meta": {"createdAt": now, "updatedAt": now},
    }


def build_system_templates() -> list[dict[str, Any]]:
    invoice = document(
        "Invoice",
        [
            heading("Invoice", 1),
            paragraph("<p><strong>From</strong> — Paperflow Studio<br>123 Example Street</p>"),
            table(
                [16, 44, 20, 20],
                [
                    ["Item", "Description", "Qty", "Amount"],
                    ["1", "Design retainers", "2", "$1,200.00"],
                    ["2", "Document automation", "1", "$2,400.00"],
                ],
            ),
            spacer(6),
            table(
                [60, 40],
                [["Total", "$3,600.00"]],
                header_row=False,
            ),
        ],
        theme="modern",
    )

    letter = document(
        "Business letter",
        [
            paragraph("<p>12 October 2026</p>"),
            paragraph("<p>Dear Ms. Rivera,</p>"),
            heading("Subject: Partnership renewal", 2),
            paragraph(
                "<p>Thank you for the continued partnership over the past year. "
                "This letter confirms the renewal of our agreement for a further "
                "twelve-month term under the existing terms and conditions.</p>"
            ),
            paragraph(
                "<p>Please review the attached schedule and let us know if anything needs adjusting.</p>"
            ),
            spacer(10),
            paragraph("<p>Yours sincerely,</p>"),
            signature("Authorised signature"),
        ],
        theme="classic",
    )

    report = document(
        "Project report",
        [
            heading("Quarterly project report", 1),
            paragraph("<p>Prepared by the delivery team · Q3 2026</p>"),
            heading("Summary", 2),
            paragraph(
                "<p>Delivery remained on schedule across all workstreams. "
                "Three milestones were completed and one was deferred to the next quarter.</p>"
            ),
            heading("Milestones", 3),
            {
                "id": _id(),
                "type": "bulletedList",
                "items": ["Discovery complete", "Design system shipped", "Editor beta released"],
            },
            heading("Metrics", 3),
            table([50, 50], [["Metric", "Value"], ["On-time delivery", "92%"], ["Open defects", "4"]]),
        ],
        theme="editorial",
    )

    certificate = document(
        "Certificate of completion",
        [
            spacer(20),
            {
                "id": _id(),
                "type": "heading",
                "level": 1,
                "text": "Certificate of Completion",
                "style": {"textAlign": "center"},
            },
            paragraph('<p style="text-align:center">This certifies that</p>'),
            {
                "id": _id(),
                "type": "field",
                "field": {"key": "student_name", "label": "Recipient", "kind": "shortText", "required": True},
                "style": {"textAlign": "center", "fontSize": 18, "fontWeight": 600},
            },
            paragraph('<p style="text-align:center">has successfully completed the programme.</p>'),
            spacer(16),
            {
                "id": _id(),
                "type": "section",
                "title": "",
                "blocks": [signature("Programme director"), signature("Date")],
            },
        ],
        theme="classic",
    )

    application_form = document(
        "Enrolment form",
        [
            heading("Enrolment form", 1),
            paragraph(
                "<p>Complete the details below to enrol. Fields marked with an asterisk are required.</p>"
            ),
            field("full_name", "Full name", "shortText", required=True, placeholder="Jane Doe"),
            field("email", "Email address", "email", required=True),
            field("phone", "Phone", "phone", required=False),
            field("start_date", "Preferred start date", "date", required=True),
            field(
                "format", "Class format", "dropdown", required=True, options=["In person", "Online", "Hybrid"]
            ),
            field("experience", "Previous experience", "longText", required=False, placeholder="Optional"),
            {
                "id": _id(),
                "type": "section",
                "title": "Terms",
                "blocks": [
                    field(
                        "agreement",
                        "I accept the terms and conditions",
                        "checkbox",
                        required=True,
                        options=["I agree"],
                    ),
                ],
            },
        ],
        theme="modern",
    )

    blank = document("Untitled document", [heading("Untitled document", 1), paragraph("<p></p>")])

    return [
        {
            "name": "Blank document",
            "description": "Start from a clean page.",
            "category": "general",
            "content": blank,
        },
        {
            "name": "Invoice",
            "description": "Itemised invoice with totals and a modern theme.",
            "category": "business",
            "content": invoice,
        },
        {
            "name": "Business letter",
            "description": "Formal letter with a signature block.",
            "category": "business",
            "content": letter,
        },
        {
            "name": "Project report",
            "description": "Structured report with headings, lists, and a metrics table.",
            "category": "reports",
            "content": report,
        },
        {
            "name": "Certificate of completion",
            "description": "Award certificate with a personalised name field.",
            "category": "certificates",
            "content": certificate,
        },
        {
            "name": "Enrolment form",
            "description": "Fillable form with validation and a terms checkbox.",
            "category": "forms",
            "content": application_form,
        },
    ]
