import type { Block, TableBlock } from "@/document/types";

export interface MeasuredBlock {
  id: string;
  type: string;
  height: number;
  marginTop: number;
  marginBottom: number;
  keepWithNext: boolean;
  forceBreakBefore: boolean;
  rowHeights?: number[];
}

/**
 * Read per-block heights out of a rendered measurement layer. Page-break blocks
 * are not measured; instead they set `forceBreakBefore` on the following block.
 */
export function measureBlocks(root: HTMLElement, blocks: Block[]): MeasuredBlock[] {
  const result: MeasuredBlock[] = [];
  let pendingBreak = false;

  for (const block of blocks) {
    if (block.type === "pageBreak") {
      pendingBreak = true;
      continue;
    }
    const element = root.querySelector<HTMLElement>(`[data-measure-id="${cssEscape(block.id)}"]`);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    const computed = window.getComputedStyle(element);
    const marginTop = parseFloat(computed.marginTop) || 0;
    const marginBottom = parseFloat(computed.marginBottom) || 0;

    let rowHeights: number[] | undefined;
    if (block.type === "table") {
      rowHeights = Array.from(element.querySelectorAll<HTMLTableRowElement>("tr")).map(
        (row) => row.getBoundingClientRect().height,
      );
    }

    result.push({
      id: block.id,
      type: block.type,
      height: rect.height,
      marginTop,
      marginBottom,
      keepWithNext: Boolean(block.style?.keepWithNext),
      forceBreakBefore: pendingBreak,
      rowHeights,
    });
    pendingBreak = false;
  }

  return result;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

export function tableSliceRowCount(table: TableBlock): number {
  return table.rows.length + (table.headerRow ? 1 : 0);
}
