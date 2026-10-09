import { SCHEMA_VERSION } from "./types";
import type {
  Block,
  FieldCondition,
  FieldDefinition,
  FieldValidation,
  PaperflowDocument,
} from "./types";
import { DEFAULT_MARGINS, DEFAULT_THEME, PAGE_DIMENSIONS } from "./constants";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const BLOCK_TYPES = new Set([
  "heading",
  "paragraph",
  "bulletedList",
  "numberedList",
  "table",
  "image",
  "divider",
  "spacer",
  "pageBreak",
  "signature",
  "field",
  "section",
  "repeater",
]);

const FIELD_KINDS = new Set([
  "shortText",
  "longText",
  "richText",
  "email",
  "phone",
  "number",
  "date",
  "dropdown",
  "radio",
  "checkbox",
  "file",
  "signature",
]);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

function issue(issues: ValidationIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function validateField(field: unknown, path: string, issues: ValidationIssue[], keys: Set<string>): void {
  if (!isObj(field)) return issue(issues, path, "Field must be an object");
  if (!isStr(field.key) || field.key.length === 0) issue(issues, `${path}.key`, "Field key is required");
  else if (keys.has(field.key)) issue(issues, `${path}.key`, `Duplicate field key "${field.key}"`);
  else keys.add(field.key);
  if (!isStr(field.label)) issue(issues, `${path}.label`, "Field label is required");
  if (!isStr(field.kind) || !FIELD_KINDS.has(field.kind)) issue(issues, `${path}.kind`, "Unknown field kind");
  if (field.required !== undefined && !isBool(field.required)) issue(issues, `${path}.required`, "required must be boolean");
  if (field.options !== undefined) {
    if (!isArr(field.options)) issue(issues, `${path}.options`, "options must be an array");
    else
      field.options.forEach((opt, i) => {
        if (!isObj(opt) || !isStr(opt.value) || !isStr(opt.label))
          issue(issues, `${path}.options[${i}]`, "Option needs value and label");
      });
  }
}

function validateBlocks(
  blocks: unknown,
  path: string,
  issues: ValidationIssue[],
  keys: Set<string>,
  depth = 0,
): void {
  if (!isArr(blocks)) return issue(issues, path, "blocks must be an array");
  if (depth > 8) return issue(issues, path, "Nesting too deep");
  blocks.forEach((block, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(block)) return issue(issues, p, "Block must be an object");
    if (!isStr(block.id) || block.id.length === 0) issue(issues, `${p}.id`, "Block id is required");
    if (!isStr(block.type) || !BLOCK_TYPES.has(block.type)) {
      issue(issues, `${p}.type`, `Unknown block type "${String(block.type)}"`);
      return;
    }
    switch (block.type) {
      case "heading":
        if (!isStr(block.text)) issue(issues, `${p}.text`, "Heading text must be a string");
        if (![1, 2, 3, 4].includes(block.level as number)) issue(issues, `${p}.level`, "Heading level must be 1-4");
        break;
      case "paragraph":
        if (!isStr(block.html)) issue(issues, `${p}.html`, "Paragraph html must be a string");
        break;
      case "bulletedList":
      case "numberedList":
        if (!isArr(block.items) || !block.items.every(isStr)) issue(issues, `${p}.items`, "List items must be strings");
        break;
      case "table":
        if (!isArr(block.columns)) issue(issues, `${p}.columns`, "columns must be an array");
        if (!isArr(block.rows)) issue(issues, `${p}.rows`, "rows must be an array");
        break;
      case "image":
        if (!isStr(block.alt)) issue(issues, `${p}.alt`, "Image alt is required");
        break;
      case "spacer":
        if (!isNum(block.height) || block.height < 0) issue(issues, `${p}.height`, "Spacer height must be a positive number");
        break;
      case "field":
        validateField(block.field, `${p}.field`, issues, keys);
        break;
      case "signature":
        if (!isStr(block.label)) issue(issues, `${p}.label`, "Signature label is required");
        if (block.mode !== "blank" && block.mode !== "field") issue(issues, `${p}.mode`, "Signature mode must be blank or field");
        break;
      case "section":
      case "repeater":
        if (!isStr(block.title)) issue(issues, `${p}.title`, "Title is required");
        validateBlocks(block.blocks, `${p}.blocks`, issues, keys, depth + 1);
        break;
      default:
        break;
    }
  });
}

export function validateDocument(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isObj(input)) return { ok: false, issues: [{ path: "", message: "Document must be an object" }] };
  if (typeof input.schemaVersion !== "number") issue(issues, "schemaVersion", "schemaVersion is required");
  if (!isStr(input.id)) issue(issues, "id", "Document id is required");
  if (!isStr(input.title)) issue(issues, "title", "Title is required");
  if (input.layout !== "flow" && input.layout !== "fixed") issue(issues, "layout", "layout must be flow or fixed");

  if (!isObj(input.page)) issue(issues, "page", "Page settings are required");
  else {
    if (input.page.size !== "A4" && input.page.size !== "Letter") issue(issues, "page.size", "Unknown page size");
    if (input.page.orientation !== "portrait" && input.page.orientation !== "landscape")
      issue(issues, "page.orientation", "Unknown orientation");
    if (!isObj(input.page.margins)) issue(issues, "page.margins", "Margins are required");
  }

  if (!isObj(input.theme)) issue(issues, "theme", "Theme is required");
  const fieldKeys = new Set<string>();
  validateBlocks(input.blocks, "blocks", issues, fieldKeys);
  if (isObj(input.header)) validateBlocks(input.header.blocks, "header.blocks", issues, fieldKeys);
  if (isObj(input.footer)) validateBlocks(input.footer.blocks, "footer.blocks", issues, fieldKeys);

  return { ok: issues.length === 0, issues };
}

/** Repair a document to a safe, fully-populated shape. Never throws for object input. */
export function coerceDocument(input: unknown): PaperflowDocument {
  const src = isObj(input) ? input : {};
  const page = isObj(src.page) ? src.page : {};
  const margins = isObj(page.margins) ? page.margins : {};
  const theme = isObj(src.theme) ? src.theme : {};
  const size = page.size === "Letter" ? "Letter" : "A4";
  const orientation = page.orientation === "landscape" ? "landscape" : "portrait";
  const dims = PAGE_DIMENSIONS[size];

  const numOr = (v: unknown, fallback: number) => (isNum(v) ? v : fallback);
  const strOr = (v: unknown, fallback: string) => (isStr(v) ? v : fallback);

  const blocks = isArr(src.blocks) ? (src.blocks as Block[]) : [];

  return {
    schemaVersion: isNum(src.schemaVersion) ? src.schemaVersion : SCHEMA_VERSION,
    id: strOr(src.id, "doc_unknown"),
    title: strOr(src.title, "Untitled document"),
    layout: src.layout === "fixed" ? "fixed" : "flow",
    page: {
      size,
      orientation,
      margins: {
        top: numOr(margins.top, DEFAULT_MARGINS.top),
        right: numOr(margins.right, DEFAULT_MARGINS.right),
        bottom: numOr(margins.bottom, DEFAULT_MARGINS.bottom),
        left: numOr(margins.left, DEFAULT_MARGINS.left),
      },
      background: strOr(page.background, "#ffffff"),
    },
    theme: {
      id: strOr(theme.id, DEFAULT_THEME.id),
      name: strOr(theme.name, DEFAULT_THEME.name),
      headingFont: strOr(theme.headingFont, DEFAULT_THEME.headingFont),
      bodyFont: strOr(theme.bodyFont, DEFAULT_THEME.bodyFont),
      accentColor: strOr(theme.accentColor, DEFAULT_THEME.accentColor),
      textColor: strOr(theme.textColor, DEFAULT_THEME.textColor),
      baseFontSize: numOr(theme.baseFontSize, DEFAULT_THEME.baseFontSize),
      lineHeight: numOr(theme.lineHeight, DEFAULT_THEME.lineHeight),
    },
    header: isObj(src.header) && isArr(src.header.blocks)
      ? { enabled: Boolean(src.header.enabled), blocks: src.header.blocks as never }
      : { enabled: false, blocks: [] },
    footer: isObj(src.footer) && isArr(src.footer.blocks)
      ? { enabled: Boolean(src.footer.enabled), blocks: src.footer.blocks as never }
      : { enabled: false, blocks: [] },
    pageNumber: isObj(src.pageNumber)
      ? {
          enabled: Boolean(src.pageNumber.enabled),
          format: (src.pageNumber.format as never) ?? "n",
          align: (src.pageNumber.align as never) ?? "center",
          startAt: numOr(src.pageNumber.startAt, 1),
          hideOnFirst: Boolean(src.pageNumber.hideOnFirst),
        }
      : { enabled: false, format: "n", align: "center", startAt: 1, hideOnFirst: false },
    blocks: blocks.map((b) => normalizeBlockShape(b, dims)),
    meta: isObj(src.meta)
      ? {
          createdAt: strOr(src.meta.createdAt, new Date().toISOString()),
          updatedAt: strOr(src.meta.updatedAt, new Date().toISOString()),
          author: isStr(src.meta.author) ? src.meta.author : undefined,
          subject: isStr(src.meta.subject) ? src.meta.subject : undefined,
          keywords: isArr(src.meta.keywords) ? (src.meta.keywords as string[]) : undefined,
        }
      : { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };
}

function normalizeBlockShape(block: Block, _dims: { width: number; height: number }): Block {
  if (!isObj(block)) return block;
  if (block.type === "section" || block.type === "repeater") {
    return { ...block, blocks: (block.blocks ?? []).map((b) => normalizeBlockShape(b, _dims)) };
  }
  return block;
}

// --- Field submission validation -------------------------------------------

export type FieldValues = Record<string, unknown>;

export interface SubmissionValidation {
  ok: boolean;
  errors: Record<string, string>;
  cleaned: FieldValues;
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-\s0-9]{6,}$/;

function conditionMatches(condition: FieldCondition | undefined, values: FieldValues): boolean {
  if (!condition) return true;
  const current = values[condition.fieldKey];
  const target = condition.value ?? "";
  switch (condition.operator) {
    case "equals":
      return String(current ?? "") === target;
    case "notEquals":
      return String(current ?? "") !== target;
    case "contains":
      return Array.isArray(current) ? current.map(String).includes(target) : String(current ?? "").includes(target);
    case "notEmpty":
      return !isBlank(current);
    case "isEmpty":
      return isBlank(current);
    case "gt":
      return Number(current) > Number(target);
    case "lt":
      return Number(current) < Number(target);
    default:
      return true;
  }
}

export function visibleFields(fields: FieldDefinition[], values: FieldValues): FieldDefinition[] {
  return fields.filter((f) => conditionMatches(f.visibleWhen, values));
}

/** Validate a submission against the field definitions. Returns cleaned values. */
export function validateSubmission(fields: FieldDefinition[], values: FieldValues): SubmissionValidation {
  const errors: Record<string, string> = {};
  const cleaned: FieldValues = {};

  for (const field of fields) {
    if (!conditionMatches(field.visibleWhen, values)) continue;
    const raw = values[field.key];
    if (isBlank(raw)) {
      if (field.required) errors[field.key] = `${field.label} is required`;
      continue;
    }
    const validation: FieldValidation = field.validation ?? {};

    switch (field.kind) {
      case "shortText":
      case "richText": {
        const s = String(raw);
        if (validation.minLength && s.length < validation.minLength)
          errors[field.key] = `${field.label} must be at least ${validation.minLength} characters`;
        if (validation.maxLength && s.length > validation.maxLength)
          errors[field.key] = `${field.label} must be at most ${validation.maxLength} characters`;
        if (validation.pattern) {
          try {
            if (!new RegExp(validation.pattern).test(s))
              errors[field.key] = validation.patternMessage ?? `${field.label} is not in the expected format`;
          } catch {
            /* ignore invalid pattern */
          }
        }
        cleaned[field.key] = s;
        break;
      }
      case "longText": {
        const s = String(raw);
        if (validation.maxLength && s.length > validation.maxLength)
          errors[field.key] = `${field.label} must be at most ${validation.maxLength} characters`;
        cleaned[field.key] = s;
        break;
      }
      case "email": {
        const s = String(raw).trim();
        if (!EMAIL_RE.test(s)) errors[field.key] = "Enter a valid email address";
        cleaned[field.key] = s;
        break;
      }
      case "phone": {
        const s = String(raw).trim();
        if (!PHONE_RE.test(s)) errors[field.key] = "Enter a valid phone number";
        cleaned[field.key] = s;
        break;
      }
      case "number": {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          errors[field.key] = "Enter a valid number";
        } else {
          if (validation.min !== undefined && n < validation.min)
            errors[field.key] = `${field.label} must be at least ${validation.min}`;
          if (validation.max !== undefined && n > validation.max)
            errors[field.key] = `${field.label} must be at most ${validation.max}`;
          cleaned[field.key] = n;
        }
        break;
      }
      case "date": {
        const s = String(raw);
        if (Number.isNaN(Date.parse(s))) errors[field.key] = "Enter a valid date";
        cleaned[field.key] = s;
        break;
      }
      case "dropdown":
      case "radio": {
        const s = String(raw);
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        if (allowed.size > 0 && !allowed.has(s)) errors[field.key] = "Choose one of the listed options";
        cleaned[field.key] = s;
        break;
      }
      case "checkbox": {
        const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        const filtered = allowed.size > 0 ? arr.filter((v) => allowed.has(v)) : arr;
        cleaned[field.key] = filtered;
        break;
      }
      case "file":
      case "signature":
        cleaned[field.key] = raw;
        break;
      default:
        cleaned[field.key] = raw;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}
