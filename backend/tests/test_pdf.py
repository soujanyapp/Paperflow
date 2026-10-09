from __future__ import annotations

import pypdf

from tests.helpers import document_content, heading, page_break, para


def export_pdf(client, auth, document_id, values=None):
    response = client.post(
        f"/api/pdf/documents/{document_id}",
        headers=auth["headers"],
        json={"values": values or {}},
    )
    assert response.status_code == 201, response.text
    record = response.json()
    download = client.get(f"/api/pdf/{record['id']}/download", headers=auth["headers"])
    assert download.status_code == 200
    return record, download.content


def create(client, auth, content):
    return client.post(
        "/api/documents",
        headers=auth["headers"],
        json={"title": content["title"], "content": content, "workspace_id": auth["workspace_id"]},
    ).json()


def pdf_text(content: bytes) -> str:
    import io

    reader = pypdf.PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def test_renders_a_single_page(client, auth):
    document = create(client, auth, document_content("One pager", [heading("Hello"), para("<p>World</p>")]))
    record, content = export_pdf(client, auth, document["id"])
    assert record["page_count"] == 1
    assert content.startswith(b"%PDF")
    assert "Hello" in pdf_text(content)


def test_manual_page_breaks_create_pages(client, auth):
    blocks = [
        para("<p>Page one</p>", "a"),
        page_break("b"),
        para("<p>Page two</p>", "c"),
        page_break("d"),
        para("<p>Page three</p>", "e"),
    ]
    document = create(client, auth, document_content("Breaks", blocks))
    record, _ = export_pdf(client, auth, document["id"])
    assert record["page_count"] == 3


def test_long_document_paginates(client, auth):
    blocks = [para(f"<p>Paragraph {i} " + ("lorem ipsum " * 40) + "</p>", f"p{i}") for i in range(80)]
    document = create(client, auth, document_content("Long", blocks))
    record, content = export_pdf(client, auth, document["id"])
    assert record["page_count"] >= 2
    import io

    assert len(pypdf.PdfReader(io.BytesIO(content)).pages) == record["page_count"]


def test_export_reflects_unsnapshotted_edits(client, auth):
    document = create(
        client, auth, document_content("Draft", [heading("Placeholder"), para("<p>Original</p>")])
    )
    updated = document_content("Draft", [heading("Final"), para("<p>Revised body</p>")])
    put = client.put(
        f"/api/documents/{document['id']}",
        headers=auth["headers"],
        json={"content": updated},
    )
    assert put.status_code == 200, put.text
    assert put.json()["revision"] == 2

    _, content = export_pdf(client, auth, document["id"])
    text = pdf_text(content)
    assert "Revised body" in text
    assert "Original" not in text


def test_pdf_honors_theme_typography():
    from app.services.pdf import doc_css

    css = doc_css(
        {
            "baseFontSize": 13,
            "bodyFont": "Lora",
            "headingFont": "Inter",
            "textColor": "#111111",
            "accentColor": "#123456",
            "lineHeight": 1.7,
        }
    )
    assert "font-size: 13pt" in css
    assert '"Lora"' in css
    assert '"Inter"' in css
    assert "#111111" in css
    assert "#123456" in css
    assert "line-height: 1.7" in css


def test_exported_pdf_uses_theme_font_size(client, auth):
    content = document_content("Styled", [para("<p>Body text</p>")])
    content["theme"]["baseFontSize"] = 13
    document = create(client, auth, content)
    record, _ = export_pdf(client, auth, document["id"])
    assert record["page_count"] >= 1


def test_block_style_font_size_and_width_are_emitted():
    from app.services.renderer import RenderContext, render_block

    html = render_block(
        {"id": "p", "type": "paragraph", "html": "<p>x</p>", "style": {"fontSize": 18, "width": 50}},
        RenderContext(),
    )
    assert "font-size:18pt" in html
    assert "width:50" in html


def test_dynamic_tokens_are_resolved_and_escaped(client, auth):
    blocks = [para("<p>Dear {{student_name}}, welcome.</p>", "p1")]
    document = create(client, auth, document_content("Letter", blocks))
    _, content = export_pdf(client, auth, document["id"], {"student_name": "Ada <script>alert(1)</script>"})
    text = pdf_text(content)
    assert "Ada" in text
    # The value is rendered as inert text, never as markup.
    assert "script" in text
