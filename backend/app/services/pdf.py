"""PDF export via Playwright + Chromium.

The renderer keeps the canonical document model as the single source of truth:
the same JSON flows into this pipeline and into the in-browser preview. Page
numbers and repeated headers/footers use Chromium's native header/footer
templates so that pagination matches what the browser print engine produces.
"""

from __future__ import annotations

import html
from pathlib import Path

import pypdf
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from app.config import settings
from app.services.renderer import RenderContext, RenderedDocument, render_document

WEB_FONT_FAMILIES = [
    "Source Serif 4",
    "Hanken Grotesk",
    "IBM Plex Mono",
    "Lora",
    "Merriweather",
    "Inter",
]

DOC_BASE_CSS = """
:root { --pf-ink: #1a1b20; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { color: #1a1b20; font-family: "Source Serif 4", Georgia, serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pf-doc { line-height: 1.55; }
.pf-doc h1, .pf-doc h2, .pf-doc h3, .pf-doc h4 { line-height: 1.2; margin: 0 0 0.4em; }
.pf-doc p { margin: 0 0 0.65em; }
.pf-doc ul, .pf-doc ol { margin: 0 0 0.65em; padding-left: 1.5em; }
.pf-doc a { color: #2547d0; text-decoration: underline; }
.pf-doc img { max-width: 100%; }
.pf-doc blockquote { border-left: 3px solid #e2e1db; margin: 0 0 0.65em; padding-left: 1em; color: #6b6e76; }
"""


def doc_css(theme: dict) -> str:
    """Theme-derived CSS so the exported PDF matches the editor canvas."""
    body_font = str(theme.get("bodyFont") or "Source Serif 4")
    heading_font = str(theme.get("headingFont") or body_font)
    base_size = theme.get("baseFontSize") or 11
    line_height = theme.get("lineHeight") or 1.55
    text_color = theme.get("textColor") or "#1a1b20"
    accent = theme.get("accentColor") or "#2547d0"
    return f""":root {{ --pf-ink: {text_color}; --pf-accent: {accent}; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; }}
body {{
  color: {text_color};
  font-family: "{body_font}", Georgia, serif;
  font-size: {base_size}pt;
  line-height: {line_height};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}
.pf-doc {{ font-family: "{body_font}", Georgia, serif; line-height: {line_height}; }}
.pf-doc h1, .pf-doc h2, .pf-doc h3, .pf-doc h4 {{
  font-family: "{heading_font}", Georgia, serif;
  line-height: 1.2;
  margin: 0 0 0.4em;
  font-weight: 600;
}}
.pf-doc h1 {{ font-size: 2em; }}
.pf-doc h2 {{ font-size: 1.5em; }}
.pf-doc h3 {{ font-size: 1.2em; }}
.pf-doc h4 {{ font-size: 1em; }}
.pf-doc p {{ margin: 0 0 0.65em; }}
.pf-doc ul, .pf-doc ol {{ margin: 0 0 0.65em; padding-left: 1.5em; }}
.pf-doc ul {{ list-style: disc; }}
.pf-doc ol {{ list-style: decimal; }}
.pf-doc a {{ color: {accent}; text-decoration: underline; }}
.pf-doc img {{ max-width: 100%; }}
.pf-doc blockquote {{ border-left: 3px solid #e2e1db; margin: 0 0 0.65em; padding-left: 1em; color: #6b6e76; }}
"""


class PdfExportError(RuntimeError):
    pass


def _font_link(theme: dict | None = None) -> str:
    families = list(WEB_FONT_FAMILIES)
    for key in ("bodyFont", "headingFont"):
        name = (theme or {}).get(key)
        if isinstance(name, str) and name and name not in families:
            families.append(name)
    query = "&".join(
        f"family={name.replace(' ', '+')}:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700"
        if name == "Source Serif 4"
        else f"family={name.replace(' ', '+')}:wght@400;500;600;700"
        for name in families
    )
    return f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?{query}&display=swap">'


def build_body_html(rendered: RenderedDocument) -> str:
    m = rendered.margins
    page_rule = (
        f"@page {{ size: {rendered.page_css}; "
        f"margin: {m['top']}mm {m['right']}mm {m['bottom']}mm {m['left']}mm; }}"
    )
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Paperflow export</title>
{_font_link(rendered.theme)}
<style>
{page_rule}
{doc_css(rendered.theme)}
.pf-page {{ background: {rendered.background}; }}
</style></head>
<body><main class="pf-doc pf-page">{rendered.body_html}</main></body></html>"""


def _page_number_html(page_numbers: dict) -> str:
    if not page_numbers.get("enabled"):
        return ""
    fmt = page_numbers.get("format", "n")
    if fmt == "n-of-total":
        return '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
    if fmt == "page-n":
        return '<span>Page <span class="pageNumber"></span></span>'
    return '<span class="pageNumber"></span>'


def build_header_template(rendered: RenderedDocument) -> str:
    m = rendered.margins
    if not rendered.has_header:
        return "<div></div>"
    return (
        f'<div style="width:100%;padding:6mm {m["right"]}mm 0 {m["left"]}mm;font-size:9pt;color:#6b6e76;">'
        f"{rendered.header_html}</div>"
    )


def build_footer_template(rendered: RenderedDocument) -> str:
    m = rendered.margins
    parts: list[str] = []
    if rendered.footer_html:
        parts.append(rendered.footer_html)
    if rendered.page_numbers.get("enabled"):
        align = rendered.page_numbers.get("align", "center")
        parts.append(
            f'<div style="text-align:{align};font-size:9pt;color:#6b6e76;">{_page_number_html(rendered.page_numbers)}</div>'
        )
    if not parts:
        return "<div></div>"
    return (
        f'<div style="width:100%;padding:0 {m["right"]}mm 6mm {m["left"]}mm;font-size:9pt;color:#6b6e76;">'
        f"{''.join(parts)}</div>"
    )


def render_to_pdf(
    document: dict,
    output_path: Path,
    *,
    values: dict | None = None,
    asset_url=None,
    timeout_ms: int | None = None,
) -> int:
    """Render a document to a PDF file. Returns the page count."""
    ctx = RenderContext(values=values or {}, asset_url=asset_url)
    rendered = render_document(document, ctx)
    body = build_body_html(rendered)
    timeout = timeout_ms or settings.pdf_export_timeout_ms
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(args=["--no-sandbox", "--font-render-hinting=none"])
            try:
                page = browser.new_page()
                page.set_default_timeout(timeout)
                page.set_content(body, wait_until="load")
                # Wait for webfonts and images before printing.
                page.evaluate(
                    "async () => { if (document.fonts) await document.fonts.ready; "
                    "await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))); }"
                )
                page.emulate_media(media="print")
                page.pdf(
                    path=str(output_path),
                    prefer_css_page_size=True,
                    print_background=True,
                    display_header_footer=rendered.has_header or rendered.has_footer,
                    header_template=build_header_template(rendered),
                    footer_template=build_footer_template(rendered),
                )
            finally:
                browser.close()
    except PlaywrightError as exc:  # pragma: no cover - environment dependent
        raise PdfExportError(f"Chromium failed to render the document: {exc}") from exc

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise PdfExportError("PDF generation produced an empty file")

    try:
        reader = pypdf.PdfReader(str(output_path))
        page_count = len(reader.pages)
    except Exception as exc:  # pragma: no cover - defensive
        raise PdfExportError(f"Generated PDF could not be read: {exc}") from exc

    if page_count < 1:
        raise PdfExportError("Generated PDF contained no pages")
    return page_count


def image_to_data_uri(path: Path, content_type: str) -> str:
    import base64

    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{content_type};base64,{data}"


def escape(value: str) -> str:
    return html.escape(value)
