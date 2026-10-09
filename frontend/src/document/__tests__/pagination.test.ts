import { describe, expect, it } from "vitest";
import { paginate, pageBlockIds, type PaginationItem } from "../pagination";

const item = (over: Partial<PaginationItem> & { id: string }): PaginationItem => ({
  type: "paragraph",
  height: 100,
  marginTop: 0,
  marginBottom: 0,
  keepWithNext: false,
  forceBreakBefore: false,
  ...over,
});

describe("paginate", () => {
  it("keeps an empty document on a single page", () => {
    const pages = paginate([], { contentHeight: 1000 });
    expect(pages).toHaveLength(1);
    expect(pages[0].fragments).toHaveLength(0);
  });

  it("flows blocks across pages", () => {
    const items = ["a", "b", "c", "d"].map((id) => item({ id, height: 300 }));
    const pages = paginate(items, { contentHeight: 1000 });
    expect(pageBlockIds(pages)).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("honours keepWithNext so a heading is not orphaned", () => {
    const items = [
      item({ id: "intro", height: 600 }),
      item({ id: "heading", height: 100, keepWithNext: true }),
      item({ id: "body", height: 350 }),
    ];
    const pages = paginate(items, { contentHeight: 1000 });
    expect(pageBlockIds(pages)).toEqual([["intro"], ["heading", "body"]]);
  });

  it("starts a new page on a manual break", () => {
    const items = [
      item({ id: "a", height: 100 }),
      item({ id: "b", height: 100, forceBreakBefore: true }),
    ];
    const pages = paginate(items, { contentHeight: 1000 });
    expect(pageBlockIds(pages)).toEqual([["a"], ["b"]]);
  });

  it("splits a table across pages and repeats the header", () => {
    const table = item({ id: "t", type: "table", height: 640, rowHeights: [40, 200, 200, 200] });
    const pages = paginate([table], { contentHeight: 500 });
    expect(pages).toHaveLength(2);
    expect(pages[0].fragments[0]).toMatchObject({ kind: "table", id: "t", fromRow: 0, toRow: 2, repeatHeader: false });
    expect(pages[1].fragments[0]).toMatchObject({ kind: "table", id: "t", fromRow: 3, toRow: 3, repeatHeader: true });
  });

  it("does not split a table that fits", () => {
    const table = item({ id: "t", type: "table", height: 240, rowHeights: [40, 100, 100] });
    const pages = paginate([table], { contentHeight: 500 });
    expect(pages).toHaveLength(1);
    expect(pageBlockIds(pages)).toEqual([["t"]]);
  });
});
