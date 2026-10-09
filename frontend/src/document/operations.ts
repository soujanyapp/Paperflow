import type { Block, PaperflowDocument } from "./types";
import { duplicateBlockWithNewIds } from "./factory";

export interface BlockLocation {
  list: Block[];
  index: number;
  block: Block;
  parentId: string | null;
}

/** Locate a block by id anywhere in the document (including nested regions). */
export function findBlock(doc: PaperflowDocument, id: string): BlockLocation | null {
  const search = (list: Block[], parentId: string | null): BlockLocation | null => {
    for (let index = 0; index < list.length; index += 1) {
      const block = list[index];
      if (block.id === id) return { list, index, block, parentId };
      if (block.type === "section" || block.type === "repeater") {
        const found = search(block.blocks, block.id);
        if (found) return found;
      }
    }
    return null;
  };
  return search(doc.blocks, null) ?? search(doc.header.blocks as Block[], "header") ?? search(doc.footer.blocks as Block[], "footer");
}

export function findBlockById(doc: PaperflowDocument, id: string): Block | null {
  return findBlock(doc, id)?.block ?? null;
}

export function isDescendant(block: Block, candidateId: string): boolean {
  if (block.id === candidateId) return true;
  if (block.type === "section" || block.type === "repeater") {
    return block.blocks.some((child) => isDescendant(child, candidateId));
  }
  return false;
}

/** Insert a block relative to another block id. Mutates the document draft. */
export function insertBlock(
  doc: PaperflowDocument,
  block: Block,
  options: { beforeId?: string; afterId?: string; index?: number; parentId?: string } = {},
): void {
  if (options.parentId) {
    const parent = findBlockById(doc, options.parentId);
    if (parent && (parent.type === "section" || parent.type === "repeater")) {
      parent.blocks.push(block);
      return;
    }
  }
  if (options.beforeId) {
    const loc = findBlock(doc, options.beforeId);
    if (loc) {
      loc.list.splice(loc.index, 0, block);
      return;
    }
  }
  if (options.afterId) {
    const loc = findBlock(doc, options.afterId);
    if (loc) {
      loc.list.splice(loc.index + 1, 0, block);
      return;
    }
  }
  const index = options.index ?? doc.blocks.length;
  doc.blocks.splice(Math.max(0, Math.min(index, doc.blocks.length)), 0, block);
}

export function removeBlock(doc: PaperflowDocument, id: string): Block | null {
  const loc = findBlock(doc, id);
  if (!loc) return null;
  const [removed] = loc.list.splice(loc.index, 1);
  return removed ?? null;
}

export function updateBlock(
  doc: PaperflowDocument,
  id: string,
  patch: Partial<Block> | ((block: Block) => void),
): void {
  const loc = findBlock(doc, id);
  if (!loc) return;
  if (typeof patch === "function") patch(loc.block);
  else Object.assign(loc.block, patch);
}

export function duplicateBlock(doc: PaperflowDocument, id: string): string | null {
  const loc = findBlock(doc, id);
  if (!loc) return null;
  const clone = duplicateBlockWithNewIds(loc.block);
  loc.list.splice(loc.index + 1, 0, clone);
  return clone.id;
}

export function toggleBlockHidden(doc: PaperflowDocument, id: string): void {
  const loc = findBlock(doc, id);
  if (loc) loc.block.hidden = !loc.block.hidden;
}

export function toggleBlockLocked(doc: PaperflowDocument, id: string): void {
  const loc = findBlock(doc, id);
  if (loc) loc.block.locked = !loc.block.locked;
}

/**
 * Move a block to a target index within the top-level block list. Nested
 * drag-and-drop across regions is intentionally out of scope for v1; nested
 * reordering is handled by the section/repeater editors.
 */
export function moveTopLevelBlock(doc: PaperflowDocument, id: string, toIndex: number): void {
  const from = doc.blocks.findIndex((b) => b.id === id);
  if (from === -1) return;
  const [block] = doc.blocks.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, doc.blocks.length));
  doc.blocks.splice(clamped, 0, block);
}

export function flattenBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      out.push(b);
      if (b.type === "section" || b.type === "repeater") walk(b.blocks);
    }
  };
  walk(blocks);
  return out;
}
