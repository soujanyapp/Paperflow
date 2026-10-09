import type { Margins, PageSize, Theme } from "./types";

export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

export function pageDimensions(size: PageSize, orientation: "portrait" | "landscape") {
  const dim = PAGE_DIMENSIONS[size];
  return orientation === "landscape"
    ? { width: dim.height, height: dim.width }
    : { width: dim.width, height: dim.height };
}

export const DEFAULT_MARGINS: Margins = { top: 20, right: 18, bottom: 20, left: 18 };

export interface FontOption {
  label: string;
  value: string;
  category: "serif" | "sans" | "mono";
  /** Loaded from Google Fonts; otherwise assumed system-resident. */
  web: boolean;
}

export const FONT_OPTIONS: FontOption[] = [
  { label: "Source Serif", value: "Source Serif 4", category: "serif", web: true },
  { label: "Lora", value: "Lora", category: "serif", web: true },
  { label: "Merriweather", value: "Merriweather", category: "serif", web: true },
  { label: "Georgia", value: "Georgia", category: "serif", web: false },
  { label: "Times New Roman", value: "Times New Roman", category: "serif", web: false },
  { label: "Hanken Grotesk", value: "Hanken Grotesk", category: "sans", web: true },
  { label: "Inter", value: "Inter", category: "sans", web: true },
  { label: "Helvetica Neue", value: "Helvetica Neue", category: "sans", web: false },
  { label: "Arial", value: "Arial", category: "sans", web: false },
  { label: "IBM Plex Mono", value: "IBM Plex Mono", category: "mono", web: true },
  { label: "Courier New", value: "Courier New", category: "mono", web: false },
];

export const WEB_FONT_FAMILIES = FONT_OPTIONS.filter((f) => f.web).map((f) => f.value);

export const THEMES: Theme[] = [
  {
    id: "editorial",
    name: "Editorial",
    headingFont: "Source Serif 4",
    bodyFont: "Source Serif 4",
    accentColor: "#2547d0",
    textColor: "#1a1b20",
    baseFontSize: 11,
    lineHeight: 1.5,
  },
  {
    id: "modern",
    name: "Modern",
    headingFont: "Hanken Grotesk",
    bodyFont: "Hanken Grotesk",
    accentColor: "#0f766e",
    textColor: "#14161a",
    baseFontSize: 10.5,
    lineHeight: 1.6,
  },
  {
    id: "classic",
    name: "Classic",
    headingFont: "Georgia",
    bodyFont: "Georgia",
    accentColor: "#7c2d12",
    textColor: "#1c1917",
    baseFontSize: 11,
    lineHeight: 1.55,
  },
  {
    id: "mono",
    name: "Technical",
    headingFont: "IBM Plex Mono",
    bodyFont: "IBM Plex Mono",
    accentColor: "#1d4ed8",
    textColor: "#111827",
    baseFontSize: 10,
    lineHeight: 1.6,
  },
];

export const DEFAULT_THEME = THEMES[0];
