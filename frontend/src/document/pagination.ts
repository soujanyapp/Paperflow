/**
 * Block-level pagination.
 *
 * This module is deliberately pure — it takes pre-measured block heights and
 * assigns them to pages. DOM measurement lives in `measure.ts` so this logic
 * can be unit tested in Node and reused by the export pipeline.
 *
 * Heights are expressed in CSS pixels (96dpi) to match DOM measurement.
 */

export interface PaginationItem {
  id: string;
  type: string;
  height: number;
  /** For tables: per-row heights, header row at index 0. */
  rowHeights?: number[];
  marginTop: number;
  marginBottom: number;
  keepWithNext: boolean;
  forceBreakBefore: boolean;
}

export type PageFragment =
  | { kind: "full"; id: string }
  | { kind: "table"; id: string; fromRow: number; toRow: number; repeatHeader: boolean };

export interface PageLayout {
  fragments: PageFragment[];
}

export interface PaginationOptions {
  contentHeight: number;
}

export function paginate(items: PaginationItem[], options: PaginationOptions): PageLayout[] {
  const contentHeight = Math.max(1, options.contentHeight);
  const pages: PageLayout[] = [];
  let current: PageFragment[] = [];
  let used = 0;

  const flush = () => {
    if (current.length > 0) pages.push({ fragments: current });
    current = [];
    used = 0;
  };

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const next = items[i + 1];

    if (item.forceBreakBefore && current.length > 0) flush();

    if (item.type === "table" && item.rowHeights && item.rowHeights.length > 0) {
      let row = 0;
      const headerHeight = item.rowHeights[0] ?? 0;
      while (row < item.rowHeights.length) {
        const continuation = row > 0;
        const headerSpace = continuation ? headerHeight : 0;
        const nextKeep = item.keepWithNext && !continuation && next ? next.height : 0;

        if (current.length > 0 && contentHeight - used < headerSpace + (item.rowHeights[row] ?? item.height) + nextKeep) {
          flush();
        }

        let room = contentHeight - used - headerSpace;
        let startRow = row;
        let placed = 0;
        while (row < item.rowHeights.length) {
          const h = item.rowHeights[row];
          if (placed > 0 && h > room) break;
          room -= h;
          placed += 1;
          row += 1;
        }
        if (placed === 0) {
          placed = 1;
          row += 1;
          startRow = row - 1;
        }
        current.push({
          kind: "table",
          id: item.id,
          fromRow: startRow,
          toRow: row - 1,
          repeatHeader: startRow > 0,
        });
        flush();
      }
      continue;
    }

    const spaceBefore = current.length === 0 ? 0 : item.marginTop;
    const keepTogether = item.keepWithNext && next ? next.height + next.marginTop : 0;
    if (current.length > 0 && used + spaceBefore + item.height + keepTogether > contentHeight) {
      flush();
    }
    current.push({ kind: "full", id: item.id });
    used += (current.length === 1 ? 0 : item.marginTop) + item.height + item.marginBottom;
  }

  flush();
  return pages.length > 0 ? pages : [{ fragments: [] }];
}

/** Resolve a fragment list into per-page block ids for simple consumers. */
export function pageBlockIds(pages: PageLayout[]): string[][] {
  return pages.map((page) => page.fragments.map((f) => f.id));
}

export function totalPages(pages: PageLayout[]): number {
  return pages.length;
}
