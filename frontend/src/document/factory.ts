import { createId } from "./ids";
import { DEFAULT_MARGINS, DEFAULT_THEME } from "./constants";
import type {
  Block,
  BlockType,
  FieldDefinition,
  PaperflowDocument,
  ParagraphBlock,
} from "./types";
import { SCHEMA_VERSION } from "./types";
import { defaultField } from "./registry";

export function emptyParagraph(): ParagraphBlock {
  return { id: createId("blk"), type: "paragraph", html: "" };
}

export function createBlock(type: BlockType): Block {
  const id = createId("blk");
  switch (type) {
    case "heading":
      return { id, type, level: 1, text: "Section heading" };
    case "paragraph":
      return { id, type, html: "" };
    case "bulletedList":
    case "numberedList":
      return { id, type, items: ["First item", "Second item"] };
    case "table":
      return {
        id,
        type,
        headerRow: true,
        columns: [{ width: 50 }, { width: 50 }],
        rows: [
          [{ html: "Column A" }, { html: "Column B" }],
          [{ html: "" }, { html: "" }],
        ],
      };
    case "image":
      return { id, type, alt: "Image", src: "" };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, height: 8 };
    case "pageBreak":
      return { id, type };
    case "signature":
      return { id, type, label: "Signature", mode: "blank" };
    case "field":
      return { id, type, field: defaultField("shortText") };
    case "section":
      return { id, type, title: "Section", blocks: [emptyParagraph()] };
    case "repeater":
      return {
        id,
        type,
        title: "Repeating section",
        itemLabel: "Item",
        minItems: 0,
        maxItems: 10,
        blocks: [emptyParagraph()],
      };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown block type: ${String(_exhaustive)}`);
    }
  }
}

export function createFieldBlock(field: FieldDefinition): Block {
  return { id: createId("blk"), type: "field", field };
}

export function createEmptyDocument(title = "Untitled document"): PaperflowDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId("doc"),
    title,
    layout: "flow",
    page: {
      size: "A4",
      orientation: "portrait",
      margins: { ...DEFAULT_MARGINS },
      background: "#ffffff",
    },
    theme: { ...DEFAULT_THEME },
    header: { enabled: false, blocks: [] },
    footer: { enabled: false, blocks: [] },
    pageNumber: {
      enabled: false,
      format: "n",
      align: "center",
      startAt: 1,
      hideOnFirst: false,
    },
    blocks: [
      { id: createId("blk"), type: "heading", level: 1, text: title },
      emptyParagraph(),
    ],
    meta: { createdAt: now, updatedAt: now },
  };
}

export function duplicateBlockWithNewIds(block: Block): Block {
  const clone = structuredClone(block) as Block;
  const reassign = (b: Block) => {
    b.id = createId("blk");
    if (b.type === "field") {
      b.field = { ...b.field };
    }
    if (b.type === "section" || b.type === "repeater") {
      b.blocks.forEach(reassign);
    }
  };
  reassign(clone);
  return clone;
}

export function duplicateDocument(doc: PaperflowDocument, titleSuffix = " (copy)"): PaperflowDocument {
  const clone = structuredClone(doc) as PaperflowDocument;
  const now = new Date().toISOString();
  clone.id = createId("doc");
  clone.title = `${doc.title}${titleSuffix}`;
  clone.meta = { ...clone.meta, createdAt: now, updatedAt: now };
  const reassign = (list: Block[]) => list.forEach((b) => reassignBlock(b));
  const reassignBlock = (b: Block) => {
    b.id = createId("blk");
    if (b.type === "section" || b.type === "repeater") reassign(b.blocks);
  };
  reassign(clone.blocks);
  reassign(clone.header.blocks);
  reassign(clone.footer.blocks);
  return clone;
}
