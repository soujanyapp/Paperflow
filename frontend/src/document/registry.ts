import { createId, fieldKeyFromLabel } from "./ids";
import type {
  Block,
  BlockType,
  FieldDefinition,
  FieldKind,
  ParagraphBlock,
} from "./types";

export interface BlockCatalogEntry {
  type: BlockType;
  label: string;
  description: string;
  group: "text" | "structure" | "media" | "form";
  keywords: string[];
}

export const BLOCK_CATALOG: BlockCatalogEntry[] = [
  { type: "heading", label: "Heading", description: "Section title", group: "text", keywords: ["title", "h1", "h2", "section"] },
  { type: "paragraph", label: "Paragraph", description: "Rich text body", group: "text", keywords: ["text", "body", "copy"] },
  { type: "bulletedList", label: "Bulleted list", description: "Unordered list", group: "text", keywords: ["list", "bullet", "ul"] },
  { type: "numberedList", label: "Numbered list", description: "Ordered list", group: "text", keywords: ["list", "number", "ol"] },
  { type: "table", label: "Table", description: "Rows and columns", group: "structure", keywords: ["grid", "data", "rows"] },
  { type: "divider", label: "Divider", description: "Horizontal rule", group: "structure", keywords: ["line", "separator", "hr"] },
  { type: "spacer", label: "Spacer", description: "Vertical space", group: "structure", keywords: ["gap", "space", "margin"] },
  { type: "pageBreak", label: "Page break", description: "Start a new page", group: "structure", keywords: ["break", "new page"] },
  { type: "signature", label: "Signature", description: "Signature line", group: "form", keywords: ["sign", "line"] },
  { type: "section", label: "Section", description: "Grouped blocks", group: "structure", keywords: ["group", "container"] },
  { type: "repeater", label: "Repeating block", description: "Repeatable content", group: "form", keywords: ["repeat", "loop", "multiple"] },
  { type: "image", label: "Image", description: "Upload or embed", group: "media", keywords: ["photo", "logo", "picture"] },
  { type: "field", label: "Form field", description: "Input field", group: "form", keywords: ["input", "form", "question"] },
];

export interface FieldKindMeta {
  kind: FieldKind;
  label: string;
  hasOptions: boolean;
  isNumeric: boolean;
  requiresValueLabel: boolean;
}

export const FIELD_KINDS: FieldKindMeta[] = [
  { kind: "shortText", label: "Short text", hasOptions: false, isNumeric: false, requiresValueLabel: false },
  { kind: "longText", label: "Long text", hasOptions: false, isNumeric: false, requiresValueLabel: false },
  { kind: "richText", label: "Rich text", hasOptions: false, isNumeric: false, requiresValueLabel: false },
  { kind: "email", label: "Email", hasOptions: false, isNumeric: false, requiresValueLabel: false },
  { kind: "phone", label: "Phone", hasOptions: false, isNumeric: false, requiresValueLabel: false },
  { kind: "number", label: "Number", hasOptions: false, isNumeric: true, requiresValueLabel: false },
  { kind: "date", label: "Date", hasOptions: false, isNumeric: false, requiresValueLabel: false },
  { kind: "dropdown", label: "Dropdown", hasOptions: true, isNumeric: false, requiresValueLabel: true },
  { kind: "radio", label: "Radio", hasOptions: true, isNumeric: false, requiresValueLabel: true },
  { kind: "checkbox", label: "Checkboxes", hasOptions: true, isNumeric: false, requiresValueLabel: true },
  { kind: "file", label: "File upload", hasOptions: false, isNumeric: false, requiresValueLabel: false },
  { kind: "signature", label: "Signature", hasOptions: false, isNumeric: false, requiresValueLabel: false },
];

export function defaultField(kind: FieldKind): FieldDefinition {
  const label = FIELD_KINDS.find((f) => f.kind === kind)?.label ?? "Field";
  const field: FieldDefinition = {
    key: fieldKeyFromLabel(label),
    label,
    kind,
    required: false,
  };
  if (kind === "dropdown" || kind === "radio" || kind === "checkbox") {
    field.options = [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ];
  }
  if (kind === "longText" || kind === "richText") {
    field.placeholder = "Enter a response";
  }
  return field;
}

export function createUniqueField(existing: FieldDefinition[], kind: FieldKind): FieldDefinition {
  const base = defaultField(kind);
  const keys = new Set(existing.map((f) => f.key));
  if (!keys.has(base.key)) return base;
  let index = 2;
  let key = `${base.key}_${index}`;
  while (keys.has(key)) {
    index += 1;
    key = `${base.key}_${index}`;
  }
  return { ...base, key };
}

export function labelForBlock(block: Block): string {
  switch (block.type) {
    case "heading":
      return block.text || "Heading";
    case "paragraph":
      return stripHtml(block.html) || "Paragraph";
    case "bulletedList":
      return block.items[0] || "Bulleted list";
    case "numberedList":
      return block.items[0] || "Numbered list";
    case "table":
      return "Table";
    case "image":
      return block.alt || "Image";
    case "divider":
      return "Divider";
    case "spacer":
      return "Spacer";
    case "pageBreak":
      return "Page break";
    case "signature":
      return block.label || "Signature";
    case "field":
      return block.field.label || "Field";
    case "section":
      return block.title || "Section";
    case "repeater":
      return block.title || "Repeating block";
    default:
      return "Block";
  }
}

const TAG_RE = /<[^>]*>/g;
export function stripHtml(html: string): string {
  return html.replace(TAG_RE, " ").replace(/\s+/g, " ").trim();
}

/** Fill in any missing optional fields so downstream code can rely on them. */
export function normalizeBlock(block: Block): Block {
  const b = block;
  if (b.type === "table") {
    if (!Array.isArray(b.columns) || b.columns.length === 0) b.columns = [{ width: 100 }];
    const cols = b.columns.length;
    b.rows = (b.rows ?? []).map((row) => {
      const next = row.slice(0, cols);
      while (next.length < cols) next.push({ html: "" });
      return next;
    });
    if (b.rows.length === 0) b.rows = [Array.from({ length: cols }, () => ({ html: "" }))];
  }
  if (b.type === "image") {
    b.alt = b.alt ?? "";
  }
  if (b.type === "spacer") {
    b.height = typeof b.height === "number" ? b.height : 8;
  }
  return b;
}

export function newParagraph(): ParagraphBlock {
  return { id: createId("blk"), type: "paragraph", html: "" };
}
