"""Canonical document -> HTML renderer.

This is the server-side twin of the React preview. It consumes the exact same
Paperflow document JSON that the editor produces and emits HTML that Chromium
prints to PDF. Both renderers share the styling rules documented in
``frontend/src/document/styles.ts``.
"""

from __future__ import annotations

import html
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from app.services.tokens import resolve_text, resolve_tokens

PAGE_SIZES_MM: dict[str, tuple[float, float]] = {
    "A4": (210.0, 297.0),
    "Letter": (215.9, 279.4),
}

AssetUrlResolver = Callable[[str], str | None]

CSS_PROP_MAP = {
    "fontFamily": "font-family",
    "fontSize": "font-size",
    "fontWeight": "font-weight",
    "fontStyle": "font-style",
    "textDecoration": "text-decoration",
    "lineHeight": "line-height",
    "color": "color",
    "backgroundColor": "background-color",
    "textAlign": "text-align",
    "marginTop": "margin-top",
    "marginBottom": "margin-bottom",
    "paddingTop": "padding-top",
    "paddingRight": "padding-right",
    "paddingBottom": "padding-bottom",
    "paddingLeft": "padding-left",
    "borderRadius": "border-radius",
    "width": "width",
}


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def style_to_css(style: dict[str, Any] | None) -> str:
    if not style:
        return ""
    parts: list[str] = []
    for key, css_key in CSS_PROP_MAP.items():
        if key not in style or style[key] is None:
            continue
        value = style[key]
        if key == "fontFamily":
            parts.append(f'font-family:"{value}", serif')
        elif key == "fontSize":
            parts.append(f"font-size:{value}pt")
        elif key in {
            "marginTop",
            "marginBottom",
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
        }:
            parts.append(f"{css_key}:{value}mm")
        elif key == "lineHeight":
            parts.append(f"line-height:{value}")
        elif key == "width":
            parts.append(f"width:{max(1, min(100, float(value)))}%")
        elif key == "borderRadius":
            parts.append(f"border-radius:{value}px")
        else:
            parts.append(f"{css_key}:{value}")

    if style.get("borderWidth"):
        parts.append(
            f"border:{style['borderWidth']}px {style.get('borderStyle', 'solid')} "
            f"{style.get('borderColor', '#d4d4d8')}"
        )
    return ";".join(parts)


def _wrap(inner: str, style: dict[str, Any] | None) -> str:
    css = style_to_css(style)
    css_attr = f' style="{css}"' if css else ""
    return f"<div{css_attr}>{inner}</div>"


@dataclass
class RenderContext:
    values: dict[str, Any] = field(default_factory=dict)
    asset_url: AssetUrlResolver | None = None
    heading_font: str = "Source Serif 4"
    accent: str = "#2547d0"

    def resolve(self, fragment: str) -> str:
        return resolve_tokens(fragment or "", self.values)

    def resolve_text(self, text: str) -> str:
        return resolve_text(text or "", self.values)

    def asset(self, asset_id: str | None, fallback: str | None) -> str | None:
        if asset_id and self.asset_url:
            resolved = self.asset_url(asset_id)
            if resolved:
                return resolved
        return fallback or None


def render_blocks(blocks: list[dict[str, Any]], ctx: RenderContext) -> str:
    return "".join(render_block(block, ctx) for block in blocks if not block.get("hidden"))


def render_block(block: dict[str, Any], ctx: RenderContext) -> str:
    btype = block.get("type")
    style = block.get("style")

    if btype == "heading":
        level = int(block.get("level", 1))
        level = min(max(level, 1), 4)
        heading_font_css = f'font-family:"{ctx.heading_font}", serif'
        css = style_to_css(style)
        if not (style or {}).get("fontFamily"):
            css = f"{heading_font_css};{css}" if css else heading_font_css
        text = ctx.resolve_text(str(block.get("text", "")))
        inner = f'<h{level} style="margin:0;{css}">{text}</h{level}>'
        return _wrap(inner, style)

    if btype == "paragraph":
        inner = ctx.resolve(block.get("html", ""))
        return _wrap(inner, style)

    if btype in {"bulletedList", "numberedList"}:
        tag = "ol" if btype == "numberedList" else "ul"
        items = "".join(f"<li>{ctx.resolve_text(str(item))}</li>" for item in block.get("items", []))
        css = style_to_css(style)
        css_attr = f' style="{css}"' if css else ""
        return f"<{tag}{css_attr}>{items}</{tag}>"

    if btype == "table":
        return render_table(block, ctx)

    if btype == "image":
        src = ctx.asset(block.get("assetId"), block.get("src"))
        if not src:
            return ""
        alt = html.escape(str(block.get("alt", "")), quote=True)
        fit = block.get("objectFit", "contain")
        img = f'<img src="{html.escape(src, quote=True)}" alt="{alt}" style="max-width:100%;object-fit:{fit}" />'
        caption = block.get("caption")
        if caption:
            img += f'<div style="text-align:center;font-size:9pt;color:#6b6e76;margin-top:2mm">{ctx.resolve_text(str(caption))}</div>'
        return _wrap(img, style)

    if btype == "divider":
        css = style_to_css(style)
        return (
            _wrap('<hr style="border:none;border-top:1px solid #d4d4d8;margin:0" />', style)
            if css
            else '<hr style="border:none;border-top:1px solid #d4d4d8;margin:0" />'
        )

    if btype == "spacer":
        height = _num(block.get("height")) or 8
        return f'<div style="height:{height}mm"></div>'

    if btype == "pageBreak":
        return '<div style="break-after:page;page-break-after:always;height:0"></div>'

    if btype == "signature":
        return render_signature(block, ctx)

    if btype == "field":
        return render_field(block.get("field", {}), ctx, style)

    if btype == "section":
        title = block.get("title", "")
        heading = (
            f'<div style="font-weight:600;margin-bottom:1mm">{ctx.resolve_text(str(title))}</div>'
            if title
            else ""
        )
        return _wrap(heading + render_blocks(block.get("blocks", []), ctx), style)

    if btype == "repeater":
        return render_repeater(block, ctx)

    return ""


def render_table(block: dict[str, Any], ctx: RenderContext) -> str:
    columns = block.get("columns", []) or [{"width": 100}]
    rows = block.get("rows", [])
    header_row = bool(block.get("headerRow"))
    colgroup = "".join(f'<col style="width:{col.get("width", 100 / len(columns))}%" />' for col in columns)
    body: list[str] = []
    for r_index, row in enumerate(rows):
        cells: list[str] = []
        is_header = header_row and r_index == 0
        tag = "th" if is_header else "td"
        for cell in row:
            span = ""
            if cell.get("colspan"):
                span += f' colspan="{int(cell["colspan"])}"'
            if cell.get("rowspan"):
                span += f' rowspan="{int(cell["rowspan"])}"'
            align = f"text-align:{cell['align']};" if cell.get("align") else ""
            weight = "font-weight:600;" if is_header else ""
            cells.append(
                f'<{tag}{span} style="{align}{weight}border:1px solid #cbd0d8;padding:2mm 2.5mm;vertical-align:top">'
                f"{ctx.resolve(cell.get('html', ''))}</{tag}>"
            )
        body.append(f"<tr>{''.join(cells)}</tr>")
    css = style_to_css(block.get("style"))
    return (
        f'<table style="width:100%;border-collapse:collapse;{css}">'
        f"<colgroup>{colgroup}</colgroup><tbody>{''.join(body)}</tbody></table>"
    )


def render_signature(block: dict[str, Any], ctx: RenderContext) -> str:
    label = ctx.resolve_text(str(block.get("label", "Signature")))
    field_key = block.get("fieldKey")
    value = ctx.values.get(field_key) if field_key else None
    if isinstance(value, str) and value.startswith("data:image"):
        return (
            f'<div style="margin-top:4mm"><img src="{html.escape(value, quote=True)}" '
            f'alt="{label}" style="max-height:18mm" />'
            f'<div style="border-top:1px solid #1a1b20;margin-top:1mm;padding-top:1mm;font-size:9pt">{label}</div></div>'
        )
    return (
        f'<div style="margin-top:8mm">'
        f'<div style="border-bottom:1px solid #1a1b20;height:10mm"></div>'
        f'<div style="font-size:9pt;color:#6b6e76;margin-top:1mm">{label}</div></div>'
    )


def render_field(field_def: dict[str, Any], ctx: RenderContext, style: dict[str, Any] | None) -> str:
    key = field_def.get("key", "")
    label = ctx.resolve_text(str(field_def.get("label", "Field")))
    value = ctx.values.get(key)
    kind = field_def.get("kind")
    label_html = f'<span style="font-weight:600">{label}</span>' if label else ""

    if value in (None, "", []):
        return _wrap(
            f'<div style="margin-bottom:1mm">{label_html}</div>'
            f'<div style="border-bottom:1px solid #cbd0d8;height:6mm"></div>',
            style,
        )

    if kind in {"checkbox"} and isinstance(value, list):
        options = {opt["value"]: opt["label"] for opt in field_def.get("options", [])}
        rendered = ", ".join(html.escape(options.get(v, v)) for v in value)
        return _wrap(f"{label_html}: <span>{rendered}</span>", style)

    if kind == "signature" and isinstance(value, str) and value.startswith("data:image"):
        return _wrap(
            f'<div>{label_html}</div><img src="{html.escape(value, quote=True)}" style="max-height:18mm" />',
            style,
        )

    safe_value = html.escape(str(value))
    return _wrap(f"{label_html}: <span>{safe_value}</span>", style)


def render_repeater(block: dict[str, Any], ctx: RenderContext) -> str:
    items = ctx.values.get(f"__repeater__{block.get('id')}") or []
    child_blocks = block.get("blocks", [])
    title = block.get("title", "")
    heading = (
        f'<div style="font-weight:600;margin-bottom:2mm">{ctx.resolve_text(str(title))}</div>'
        if title
        else ""
    )
    if not items:
        return _wrap(heading + render_blocks(child_blocks, ctx), block.get("style"))
    rendered: list[str] = []
    for index, item in enumerate(items):
        merged = {**ctx.values, **item} if isinstance(item, dict) else ctx.values
        child_ctx = RenderContext(
            values=merged,
            asset_url=ctx.asset_url,
            heading_font=ctx.heading_font,
            accent=ctx.accent,
        )
        rendered.append(
            f'<div style="margin-bottom:4mm">'
            f'<div style="font-size:9pt;color:#6b6e76;margin-bottom:1mm">'
            f"{html.escape(str(block.get('itemLabel', 'Item')))} {index + 1}</div>"
            f"{render_blocks(child_blocks, child_ctx)}</div>"
        )
    return _wrap(heading + "".join(rendered), block.get("style"))


def render_region(blocks: list[dict[str, Any]], ctx: RenderContext) -> str:
    if not blocks:
        return ""
    inner = render_blocks(blocks, ctx)
    return f'<div style="width:100%;font-size:9pt;color:#6b6e76">{inner}</div>'


@dataclass
class RenderedDocument:
    body_html: str
    header_html: str
    footer_html: str
    page_width_mm: float
    page_height_mm: float
    margins: dict[str, float]
    background: str
    page_numbers: dict[str, Any]
    has_header: bool
    has_footer: bool
    page_css: str
    theme: dict[str, Any] = field(default_factory=dict)


def render_document(document: dict[str, Any], ctx: RenderContext, *, full: bool = True) -> RenderedDocument:
    page = document.get("page", {})
    size = page.get("size", "A4")
    orientation = page.get("orientation", "portrait")
    width_mm, height_mm = PAGE_SIZES_MM.get(size, PAGE_SIZES_MM["A4"])
    if orientation == "landscape":
        width_mm, height_mm = height_mm, width_mm
    margins = {
        "top": float(page.get("margins", {}).get("top", 20)),
        "right": float(page.get("margins", {}).get("right", 18)),
        "bottom": float(page.get("margins", {}).get("bottom", 20)),
        "left": float(page.get("margins", {}).get("left", 18)),
    }
    header = document.get("header", {})
    footer = document.get("footer", {})
    page_numbers = document.get("pageNumber", {})
    theme = document.get("theme", {}) or {}
    if theme.get("headingFont"):
        ctx.heading_font = str(theme["headingFont"])
    if theme.get("accentColor"):
        ctx.accent = str(theme["accentColor"])

    header_html = render_region(header.get("blocks", []), ctx) if header.get("enabled") else ""
    footer_html = render_region(footer.get("blocks", []), ctx) if footer.get("enabled") else ""

    page_css = f"{width_mm}mm {height_mm}mm"
    return RenderedDocument(
        body_html=render_blocks(document.get("blocks", []), ctx),
        header_html=header_html,
        footer_html=footer_html,
        page_width_mm=width_mm,
        page_height_mm=height_mm,
        margins=margins,
        background=page.get("background", "#ffffff"),
        page_numbers=page_numbers,
        has_header=bool(header_html),
        has_footer=bool(footer_html) or bool(page_numbers.get("enabled")),
        page_css=page_css,
        theme=theme,
    )
