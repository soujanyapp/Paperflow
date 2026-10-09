import * as React from "react";
import { BlockView } from "@/components/document/BlockView";
import { measureBlocks } from "@/components/document/measure";
import { pageBox, themeCss } from "@/document/styles";
import { paginate, type PageFragment, type PageLayout, type PaginationItem } from "@/document/pagination";
import { mmToPx } from "@/document/units";
import { api } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";
import type { Block, PaperflowDocument, TableBlock } from "@/document/types";

export function PreviewCanvas() {
  const doc = useEditorStore((state) => state.document);
  const box = pageBox(doc.page);
  const contentWidthPx = mmToPx(box.contentWidth);
  const contentHeightPx = mmToPx(box.contentHeight);

  const measureRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState<PageLayout[]>([{ fragments: [] }]);

  const recalc = React.useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const measured = measureBlocks(root, doc.blocks);
    const items: PaginationItem[] = measured.map((entry) => ({
      id: entry.id,
      type: entry.type,
      height: entry.height,
      rowHeights: entry.rowHeights,
      marginTop: entry.marginTop,
      marginBottom: entry.marginBottom,
      keepWithNext: entry.keepWithNext,
      forceBreakBefore: entry.forceBreakBefore,
    }));
    setLayout(paginate(items, { contentHeight: contentHeightPx }));
  }, [doc.blocks, contentHeightPx]);

  React.useLayoutEffect(() => {
    recalc();
    const root = measureRef.current;
    let observer: ResizeObserver | undefined;
    if (root && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => recalc());
      observer.observe(root);
    }
    if (typeof document !== "undefined" && "fonts" in document) {
      void document.fonts.ready.then(recalc);
    }
    return () => observer?.disconnect();
  }, [recalc]);

  const blockById = React.useMemo(() => {
    const map = new Map<string, Block>();
    for (const block of doc.blocks) map.set(block.id, block);
    return map;
  }, [doc.blocks]);

  return (
    <div className="flex min-h-full flex-col items-center gap-6 px-6 py-8">
      <MeasurementLayer ref={measureRef} doc={doc} width={contentWidthPx} />

      {layout.map((page, pageIndex) => (
        <PageFrame
          key={pageIndex}
          doc={doc}
          pageIndex={pageIndex}
          totalPages={layout.length}
          box={box}
          fragments={page.fragments}
          blockById={blockById}
        />
      ))}
    </div>
  );
}

const MeasurementLayer = React.forwardRef<HTMLDivElement, { doc: PaperflowDocument; width: number }>(
  ({ doc, width }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className="pf-doc"
      style={{
        position: "absolute",
        left: -100000,
        top: 0,
        width,
        visibility: "hidden",
        pointerEvents: "none",
        ...themeCss(doc.theme),
      }}
    >
      {doc.blocks
        .filter((block) => block.type !== "pageBreak")
        .map((block) => (
          <div key={block.id} data-measure-id={block.id}>
            <BlockView block={block} theme={doc.theme} assetUrl={api.assetUrl} />
          </div>
        ))}
    </div>
  ),
);
MeasurementLayer.displayName = "MeasurementLayer";

function PageFrame({
  doc,
  pageIndex,
  totalPages,
  box,
  fragments,
  blockById,
}: {
  doc: PaperflowDocument;
  pageIndex: number;
  totalPages: number;
  box: ReturnType<typeof pageBox>;
  fragments: PageFragment[];
  blockById: Map<string, Block>;
}) {
  const hideChrome = doc.pageNumber.hideOnFirst && pageIndex === 0;
  const number = doc.pageNumber.startAt + pageIndex;
  const pageNumberText =
    doc.pageNumber.format === "n-of-total"
      ? `${number} / ${doc.pageNumber.startAt + totalPages - 1}`
      : doc.pageNumber.format === "page-n"
        ? `Page ${number}`
        : String(number);

  return (
    <div
      className="pf-page"
      style={{
        width: `${box.width}mm`,
        minHeight: `${box.height}mm`,
        background: doc.page.background,
        ...themeCss(doc.theme),
      }}
    >
      {doc.header.enabled && doc.header.blocks.length > 0 ? (
        <div className="absolute inset-x-0 opacity-80" style={{ top: `${box.margins.top / 2}mm`, paddingInline: `${box.margins.left}mm`, fontSize: "0.8em" }}>
          {doc.header.blocks.map((block) => (
            <BlockView key={block.id} block={block} theme={doc.theme} assetUrl={api.assetUrl} />
          ))}
        </div>
      ) : null}

      <div
        className="pf-doc"
        style={{
          paddingTop: `${box.margins.top}mm`,
          paddingRight: `${box.margins.right}mm`,
          paddingBottom: `${box.margins.bottom}mm`,
          paddingLeft: `${box.margins.left}mm`,
        }}
      >
        {fragments.map((fragment, index) => {
          const block = blockById.get(fragment.id);
          if (!block) return null;
          if (fragment.kind === "full") {
            return <BlockView key={`${fragment.id}-${index}`} block={block} theme={doc.theme} assetUrl={api.assetUrl} />;
          }
          return (
            <TableFragment
              key={`${fragment.id}-${index}`}
              table={block as TableBlock}
              fromRow={fragment.fromRow}
              toRow={fragment.toRow}
              repeatHeader={fragment.repeatHeader}
            />
          );
        })}
      </div>

      {doc.footer.enabled && doc.footer.blocks.length > 0 ? (
        <div className="absolute inset-x-0 opacity-80" style={{ bottom: `${box.margins.bottom / 2}mm`, paddingInline: `${box.margins.left}mm`, fontSize: "0.8em" }}>
          {doc.footer.blocks.map((block) => (
            <BlockView key={block.id} block={block} theme={doc.theme} assetUrl={api.assetUrl} />
          ))}
        </div>
      ) : null}

      {doc.pageNumber.enabled && !hideChrome ? (
        <div
          className="absolute inset-x-0 text-[0.75em] opacity-70"
          style={{ bottom: `${Math.max(4, box.margins.bottom / 2.6)}mm`, paddingInline: `${box.margins.left}mm`, textAlign: doc.pageNumber.align }}
        >
          {pageNumberText}
        </div>
      ) : null}
    </div>
  );
}

function TableFragment({
  table,
  fromRow,
  toRow,
  repeatHeader,
}: {
  table: TableBlock;
  fromRow: number;
  toRow: number;
  repeatHeader: boolean;
}) {
  const hasHeader = table.headerRow;
  const offset = hasHeader ? 1 : 0;
  const bodyRows: number[] = [];
  for (let visual = fromRow; visual <= toRow; visual += 1) {
    const dataIndex = visual - offset;
    if (dataIndex >= 0 && dataIndex < table.rows.length) bodyRows.push(dataIndex);
  }
  const showHeader = hasHeader && (repeatHeader || fromRow === 0);

  return (
    <table className="w-full border-collapse text-[0.95em]">
      <colgroup>
        {table.columns.map((column, index) => (
          <col key={index} style={{ width: `${column.width}%` }} />
        ))}
      </colgroup>
      {showHeader ? (
        <thead>
          <tr>
            {table.rows[0]?.map((cell, cellIndex) => (
              <th
                key={cellIndex}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                style={{ textAlign: cell.align, fontWeight: 600 }}
                className="border border-current/25 px-2 py-1 text-left align-top"
                dangerouslySetInnerHTML={{ __html: cell.html || "" }}
              />
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {bodyRows.map((rowIndex) => (
          <tr key={rowIndex}>
            {table.rows[rowIndex].map((cell, cellIndex) => (
              <td
                key={cellIndex}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                style={{ textAlign: cell.align }}
                className="border border-current/25 px-2 py-1 align-top"
                dangerouslySetInnerHTML={{ __html: cell.html || "" }}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
