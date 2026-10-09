/**
 * Paperflow document model.
 *
 * This module is the single source of truth for the editor, the browser
 * preview, persistence, and PDF export. It must stay free of React and of any
 * DOM-only APIs so it can be serialised, validated and rendered on the server.
 *
 * All measurement values are millimetres unless stated otherwise.
 */

export const SCHEMA_VERSION = 1;

export type PageSize = "A4" | "Letter";
export type Orientation = "portrait" | "landscape";
export type LayoutMode = "flow" | "fixed";
export type TextAlign = "left" | "center" | "right" | "justify";

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarginKey = keyof Margins;

export interface PageSettings {
  size: PageSize;
  orientation: Orientation;
  margins: Margins;
  background: string;
}

export interface Theme {
  id: string;
  name: string;
  headingFont: string;
  bodyFont: string;
  accentColor: string;
  textColor: string;
  baseFontSize: number; // pt
  lineHeight: number;
}

export interface BlockStyle {
  fontFamily?: string;
  fontSize?: number; // pt
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  lineHeight?: number;
  color?: string;
  backgroundColor?: string;
  textAlign?: TextAlign;
  marginTop?: number;
  marginBottom?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  borderWidth?: number; // px
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted";
  borderRadius?: number; // px
  width?: number; // percent of content width, 1..100
  keepWithNext?: boolean;
  columns?: number;
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BlockType =
  | "heading"
  | "paragraph"
  | "bulletedList"
  | "numberedList"
  | "table"
  | "image"
  | "divider"
  | "spacer"
  | "pageBreak"
  | "signature"
  | "field"
  | "section"
  | "repeater";

export interface BlockBase {
  id: string;
  type: BlockType;
  style?: BlockStyle;
  frame?: Frame;
  hidden?: boolean;
  locked?: boolean;
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  level: 1 | 2 | 3 | 4;
  text: string;
}

export interface ParagraphBlock extends BlockBase {
  type: "paragraph";
  html: string;
}

export interface ListBlock extends BlockBase {
  type: "bulletedList" | "numberedList";
  items: string[];
}

export interface TableCell {
  html: string;
  colspan?: number;
  rowspan?: number;
  align?: TextAlign;
}

export interface TableColumn {
  width: number; // percent
}

export interface TableBlock extends BlockBase {
  type: "table";
  columns: TableColumn[];
  rows: TableCell[][];
  headerRow: boolean;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  assetId?: string;
  src?: string;
  alt: string;
  caption?: string;
  objectFit?: "contain" | "cover";
}

export interface DividerBlock extends BlockBase {
  type: "divider";
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number;
}

export interface PageBreakBlock extends BlockBase {
  type: "pageBreak";
}

export interface SignatureBlock extends BlockBase {
  type: "signature";
  label: string;
  mode: "blank" | "field";
  fieldKey?: string;
}

export type FieldKind =
  | "shortText"
  | "longText"
  | "richText"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "file"
  | "signature";

export interface FieldOption {
  value: string;
  label: string;
}

export type ConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notEmpty"
  | "isEmpty"
  | "gt"
  | "lt";

export interface FieldCondition {
  fieldKey: string;
  operator: ConditionOperator;
  value?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  defaultValue?: string | number | boolean | string[];
  visibleWhen?: FieldCondition;
}

export interface FieldBlock extends BlockBase {
  type: "field";
  field: FieldDefinition;
}

export interface SectionBlock extends BlockBase {
  type: "section";
  title: string;
  blocks: Block[];
}

export interface RepeaterBlock extends BlockBase {
  type: "repeater";
  title: string;
  itemLabel: string;
  minItems: number;
  maxItems: number;
  blocks: Block[];
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | PageBreakBlock
  | SignatureBlock
  | FieldBlock
  | SectionBlock
  | RepeaterBlock;

/** Blocks that may appear in a header or footer region. */
export type RegionBlock = ParagraphBlock | HeadingBlock | ImageBlock | DividerBlock | SpacerBlock;

export interface PageRegion {
  enabled: boolean;
  blocks: RegionBlock[];
}

export interface PageNumberSettings {
  enabled: boolean;
  format: "n" | "n-of-total" | "page-n";
  align: TextAlign;
  startAt: number;
  hideOnFirst: boolean;
}

export interface DocumentMeta {
  createdAt: string;
  updatedAt: string;
  author?: string;
  subject?: string;
  keywords?: string[];
}

export interface PaperflowDocument {
  schemaVersion: number;
  id: string;
  title: string;
  layout: LayoutMode;
  page: PageSettings;
  theme: Theme;
  header: PageRegion;
  footer: PageRegion;
  pageNumber: PageNumberSettings;
  blocks: Block[];
  meta: DocumentMeta;
}

export interface FormPublishSettings {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  allowMultiple: boolean;
  requireAuth: boolean;
  collectEmail: boolean;
  closesAt?: string | null;
}

/** A snapshot of the fields derivable from a document, in document order. */
export function collectFields(blocks: Block[]): FieldDefinition[] {
  const out: FieldDefinition[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === "field") out.push(block.field);
      else if (block.type === "section" || block.type === "repeater") walk(block.blocks);
    }
  };
  walk(blocks);
  return out;
}

export function collectAssetIds(blocks: Block[]): string[] {
  const ids: string[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === "image" && block.assetId) ids.push(block.assetId);
      else if (block.type === "section" || block.type === "repeater") walk(block.blocks);
    }
  };
  walk(blocks);
  return ids;
}
