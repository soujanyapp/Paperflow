import { describe, expect, it } from "vitest";
import { createEmptyDocument, duplicateBlockWithNewIds, duplicateDocument } from "../factory";
import { createBlock } from "../factory";
import { findBlock, duplicateBlock, removeBlock, moveTopLevelBlock } from "../operations";
import { validateDocument } from "../schema";
import type { SectionBlock } from "../types";

describe("factory", () => {
  it("creates a valid empty document", () => {
    const doc = createEmptyDocument("Report");
    expect(doc.title).toBe("Report");
    expect(validateDocument(doc).ok).toBe(true);
  });

  it("creates every registered block type without throwing", () => {
    const types = [
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
    ] as const;
    for (const type of types) {
      expect(createBlock(type).type).toBe(type);
    }
  });

  it("assigns fresh ids when duplicating a nested block", () => {
    const section = createBlock("section") as SectionBlock;
    const clone = duplicateBlockWithNewIds(section) as SectionBlock;
    expect(clone.id).not.toBe(section.id);
    expect(clone.blocks[0].id).not.toBe(section.blocks[0].id);
  });

  it("duplicates a document with a new id and unique block ids", () => {
    const doc = createEmptyDocument();
    const copy = duplicateDocument(doc);
    expect(copy.id).not.toBe(doc.id);
    expect(copy.title).toContain("(copy)");
    expect(copy.blocks[0].id).not.toBe(doc.blocks[0].id);
  });
});

describe("operations", () => {
  it("finds, duplicates, moves and removes blocks", () => {
    const doc = createEmptyDocument();
    const target = doc.blocks[0];
    expect(findBlock(doc, target.id)?.index).toBe(0);

    const newId = duplicateBlock(doc, target.id);
    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks[1].id).toBe(newId);

    moveTopLevelBlock(doc, newId!, 0);
    expect(doc.blocks[0].id).toBe(newId);

    removeBlock(doc, newId!);
    expect(doc.blocks.find((b) => b.id === newId)).toBeUndefined();
  });
});
