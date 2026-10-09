import type { BlockStyle, Margins, PageSettings, Theme } from "./types";
import { pageDimensions } from "./constants";

import type { CSSProperties } from "react";

export function fontStack(family: string | undefined, fallback = "var(--font-serif)"): string {
  if (!family) return fallback;
  return `"${family}", ${fallback}`;
}

/** Convert a block style into React CSS properties. Values are print-accurate (pt/mm). */
export function blockStyleToCss(style: BlockStyle | undefined): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.fontFamily) css.fontFamily = fontStack(style.fontFamily);
  if (style.fontSize) css.fontSize = `${style.fontSize}pt`;
  if (style.fontWeight) css.fontWeight = style.fontWeight;
  if (style.fontStyle) css.fontStyle = style.fontStyle;
  if (style.textDecoration) css.textDecoration = style.textDecoration;
  if (style.lineHeight) css.lineHeight = style.lineHeight;
  if (style.color) css.color = style.color;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.textAlign) css.textAlign = style.textAlign;
  if (style.marginTop !== undefined) css.marginTop = `${style.marginTop}mm`;
  if (style.marginBottom !== undefined) css.marginBottom = `${style.marginBottom}mm`;
  if (style.paddingTop !== undefined) css.paddingTop = `${style.paddingTop}mm`;
  if (style.paddingRight !== undefined) css.paddingRight = `${style.paddingRight}mm`;
  if (style.paddingBottom !== undefined) css.paddingBottom = `${style.paddingBottom}mm`;
  if (style.paddingLeft !== undefined) css.paddingLeft = `${style.paddingLeft}mm`;
  if (style.borderWidth) {
    css.borderWidth = `${style.borderWidth}px`;
    css.borderStyle = style.borderStyle ?? "solid";
    css.borderColor = style.borderColor ?? "var(--border)";
  }
  if (style.borderRadius !== undefined) css.borderRadius = `${style.borderRadius}px`;
  return css;
}

export function wrapperStyle(style: BlockStyle | undefined): CSSProperties {
  const css = blockStyleToCss(style);
  if (style?.width !== undefined) {
    css.width = `${Math.max(1, Math.min(100, style.width))}%`;
  }
  return css;
}

export function themeCss(theme: Theme): CSSProperties {
  return {
    fontFamily: fontStack(theme.bodyFont),
    fontSize: `${theme.baseFontSize}pt`,
    lineHeight: theme.lineHeight,
    color: theme.textColor,
  };
}

export const PAGE_CSS_SIZE: Record<string, string> = {
  A4: "210mm 297mm",
  Letter: "215.9mm 279.4mm",
};

export interface PageBox {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  margins: Margins;
}

export function pageBox(page: PageSettings): PageBox {
  const { width, height } = pageDimensions(page.size, page.orientation);
  const { margins } = page;
  return {
    width,
    height,
    contentWidth: Math.max(1, width - margins.left - margins.right),
    contentHeight: Math.max(1, height - margins.top - margins.bottom),
    margins,
  };
}
