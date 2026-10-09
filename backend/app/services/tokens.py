"""Safe resolution of dynamic placeholders such as ``{{student_name}}``.

The golden rule: never build HTML with string concatenation or ``str.format``.
We walk the template's text nodes, HTML-escape every substituted value, and then
run the result through an allow-list sanitizer (nh3). Values can therefore never
introduce markup.
"""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from typing import Any

import nh3

TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")

ALLOWED_TAGS = {
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "span",
    "a",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "img",
    "hr",
    "div",
    "sub",
    "sup",
    "mark",
}

ALLOWED_ATTRIBUTES = {
    "*": {"style", "class"},
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "width", "height"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
    "table": {"style"},
}

ALLOWED_URL_SCHEMES = {"http", "https", "mailto", "tel", "data"}


def sanitize_html(value: str) -> str:
    if not value:
        return ""
    return nh3.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=ALLOWED_URL_SCHEMES,
        link_rel="noopener noreferrer nofollow",
    )


def sanitize_text(value: str) -> str:
    """Escape a plain-text value for safe interpolation."""
    return html.escape(str(value), quote=True)


class _TokenTextReplacer(HTMLParser):
    def __init__(self, values: dict[str, Any]):
        super().__init__(convert_charrefs=False)
        self.values = values
        self.out: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        rendered = "".join(
            f' {name}="{html.escape(value, quote=True)}"' if value is not None else f" {name}"
            for name, value in attrs
        )
        self.out.append(f"<{tag}{rendered}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        rendered = "".join(
            f' {name}="{html.escape(value, quote=True)}"' if value is not None else f" {name}"
            for name, value in attrs
        )
        self.out.append(f"<{tag}{rendered} />")

    def handle_endtag(self, tag: str) -> None:
        self.out.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.out.append(self._replace(data))

    def handle_entityref(self, name: str) -> None:
        self.out.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.out.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        # Drop comments entirely.
        return

    def _replace(self, data: str) -> str:
        def sub(match: re.Match[str]) -> str:
            key = match.group(1)
            if key not in self.values:
                return ""
            value = self.values[key]
            if isinstance(value, bool):
                return "Yes" if value else "No"
            if isinstance(value, (list, tuple)):
                return sanitize_text(", ".join(str(item) for item in value))
            if value is None:
                return ""
            return sanitize_text(str(value))

        return TOKEN_RE.sub(sub, data)


def resolve_tokens(html_fragment: str, values: dict[str, Any]) -> str:
    """Replace tokens in text nodes with escaped values, then sanitize."""
    if not html_fragment:
        return ""
    parser = _TokenTextReplacer(values)
    parser.feed(html_fragment)
    parser.close()
    return sanitize_html("".join(parser.out))


def resolve_text(text: str, values: dict[str, Any]) -> str:
    """Replace tokens in a plain-text string, escaping substituted values."""
    if not text:
        return ""
    return TOKEN_RE.sub(lambda m: _render_value(values.get(m.group(1), "")), text)


def _render_value(value: Any) -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (list, tuple)):
        return sanitize_text(", ".join(str(item) for item in value))
    if value is None:
        return ""
    return sanitize_text(str(value))


def extract_token_keys(html_fragment: str) -> set[str]:
    return set(TOKEN_RE.findall(html_fragment or ""))
