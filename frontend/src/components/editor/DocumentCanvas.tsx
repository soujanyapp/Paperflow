import * as React from "react";
import { Plus } from "lucide-react";
import { BlockView } from "@/components/document/BlockView";
import { BlockSlot } from "@/components/editor/BlockSlot";
import { pageBox, themeCss } from "@/document/styles";
import { createBlock } from "@/document/factory";
import { api } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";
import type { Block, PaperflowDocument } from "@/document/types";

function splitPages(blocks: Block[]): Block[][] {
  const pages: Block[][] = [[]];
  for (const block of blocks) {
    if (block.type === "pageBreak") {
      pages.push([]);
      continue;
    }
    pages[pages.length - 1].push(block);
  }
  return pages;
}

function pageNumberLabel(doc: PaperflowDocument, pageIndex: number, total: number): string {
  const { format, startAt } = doc.pageNumber;
  const number = startAt + pageIndex;
  if (format === "n-of-total") return `${number} / ${startAt + total - 1}`;
  if (format === "page-n") return `Page ${number}`;
  return String(number);
}

export function DocumentCanvas() {
  const doc = useEditorStore((state) => state.document);
  const zoom = useEditorStore((state) => state.zoom);
  const setEditingBlock = useEditorStore((state) => state.setEditingBlock);
  const insertBlock = useEditorStore((state) => state.insertBlock);
  const selectBlock = useEditorStore((state) => state.selectBlock);

  const box = pageBox(doc.page);
  const pages = splitPages(doc.blocks);
  const style = themeCss(doc.theme);

  return (
    <div
      className="flex min-h-full flex-col items-center gap-6 px-6 py-8"
      style={{ zoom } as React.CSSProperties}
      onMouseDown={() => selectBlock(null)}
    >
      {pages.map((blocks, pageIndex) => {
        const hideChrome = doc.pageNumber.hideOnFirst && pageIndex === 0;
        return (
          <div
            key={pageIndex}
            className="pf-page relative"
            style={{
              width: `${box.width}mm`,
              minHeight: `${box.height}mm`,
              background: doc.page.background,
              ...style,
            }}
          >
            {doc.header.enabled && doc.header.blocks.length > 0 ? (
              <div className="absolute left-0 right-0" style={{ top: `${box.margins.top / 2}mm`, paddingInline: `${box.margins.left}mm` }}>
                {doc.header.blocks.map((block) => (
                  <div key={block.id} style={{ fontSize: "0.8em" }} className="opacity-80">
                    <BlockView block={block} theme={doc.theme} assetUrl={api.assetUrl} />
                  </div>
                ))}
              </div>
            ) : null}

            <div
              className="pf-doc relative"
              style={{
                paddingTop: `${box.margins.top}mm`,
                paddingRight: `${box.margins.right}mm`,
                paddingBottom: `${box.margins.bottom}mm`,
                paddingLeft: `${box.margins.left}mm`,
              }}
            >
              {blocks.map((block) => (
                <BlockSlot key={block.id} block={block} />
              ))}
              {pageIndex === pages.length - 1 ? (
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    const created = createBlock("paragraph");
                    insertBlock(created);
                    setEditingBlock(created.id);
                  }}
                >
                  <Plus className="size-3.5" /> Click to add a block
                </button>
              ) : null}
            </div>

            {doc.footer.enabled && doc.footer.blocks.length > 0 ? (
              <div
                className="absolute left-0 right-0"
                style={{ bottom: `${box.margins.bottom / 2}mm`, paddingInline: `${box.margins.left}mm` }}
              >
                {doc.footer.blocks.map((block) => (
                  <div key={block.id} style={{ fontSize: "0.8em" }} className="opacity-80">
                    <BlockView block={block} theme={doc.theme} assetUrl={api.assetUrl} />
                  </div>
                ))}
              </div>
            ) : null}

            {doc.pageNumber.enabled && !hideChrome ? (
              <div
                className="absolute left-0 right-0 text-[0.75em] opacity-70"
                style={{
                  bottom: `${Math.max(4, box.margins.bottom / 2.6)}mm`,
                  paddingInline: `${box.margins.left}mm`,
                  textAlign: doc.pageNumber.align,
                }}
              >
                {pageNumberLabel(doc, pageIndex, pages.length)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
