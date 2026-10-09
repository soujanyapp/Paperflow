import type { Block, TableBlock, Theme } from "@/document/types";
import { blockStyleToCss, fontStack } from "@/document/styles";
import { cn } from "@/lib/utils";

export type BlockViewMode = "static" | "form" | "preview";

export interface BlockViewProps {
  block: Block;
  theme: Theme;
  mode?: BlockViewMode;
  values?: Record<string, unknown>;
  resolveValue?: (key: string) => string | undefined;
  assetUrl?: (assetId: string) => string;
  onChange?: (key: string, value: unknown) => void;
  className?: string;
}

function readValue(values: Record<string, unknown> | undefined, key: string): unknown {
  if (!values) return undefined;
  return values[key];
}

function valueToText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function BlockView({ block, theme, mode = "static", values, assetUrl, onChange, className }: BlockViewProps) {
  const style = blockStyleToCss(block.style);
  const headingFamily = fontStack(theme.headingFont);

  switch (block.type) {
    case "heading": {
      const Tag = (`h${block.level}` as unknown) as "h1";
      return (
        <Tag
          className={cn("pf-block", className)}
          style={{ ...style, fontFamily: style.fontFamily ?? headingFamily }}
          dangerouslySetInnerHTML={{ __html: block.text }}
        />
      );
    }
    case "paragraph":
      return (
        <div className={cn("pf-block", className)} style={style} dangerouslySetInnerHTML={{ __html: block.html || "<p></p>" }} />
      );
    case "bulletedList":
      return (
        <ul className={cn("pf-block", className)} style={style}>
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    case "numberedList":
      return (
        <ol className={cn("pf-block", className)} style={style}>
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      );
    case "table":
      return <TableView block={block} className={className} style={style} />;
    case "image": {
      const src = block.src || (block.assetId && assetUrl ? assetUrl(block.assetId) : "");
      return (
        <figure className={cn("pf-block", className)} style={style}>
          {src ? (
            <img src={src} alt={block.alt} style={{ width: "100%", objectFit: block.objectFit ?? "contain" }} />
          ) : (
            <div className="grid h-32 place-items-center rounded border border-dashed border-current/20 text-xs opacity-50">
              {block.alt || "Image"}
            </div>
          )}
          {block.caption ? (
            <figcaption className="mt-1 text-center text-[0.8em] opacity-70">{block.caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    case "divider":
      return (
        <div className={cn("pf-block", className)} style={style}>
          <hr className="my-2 border-t border-current/25" />
        </div>
      );
    case "spacer":
      return <div className={cn("pf-block", className)} style={style} aria-hidden />;
    case "pageBreak":
      return null;
    case "signature":
      return (
        <div className={cn("pf-block", className)} style={style}>
          <div className="mt-6 border-t border-current/40 pt-1 text-[0.8em] opacity-80">{block.label}</div>
        </div>
      );
    case "field":
      return <FieldStatic block={block} mode={mode} values={values} style={style} className={className} />;
    case "section":
      return (
        <section className={cn("pf-block", className)} style={style}>
          {block.title ? <h3 style={{ fontFamily: headingFamily }}>{block.title}</h3> : null}
          {block.blocks.map((child) => (
            <BlockView
              key={child.id}
              block={child}
              theme={theme}
              mode={mode}
              values={values}
              assetUrl={assetUrl}
              onChange={onChange}
            />
          ))}
        </section>
      );
    case "repeater":
      return (
        <section className={cn("pf-block", className)} style={style}>
          {block.title ? <h3 style={{ fontFamily: headingFamily }}>{block.title}</h3> : null}
          {block.blocks.map((child) => (
            <BlockView
              key={child.id}
              block={child}
              theme={theme}
              mode={mode}
              values={values}
              assetUrl={assetUrl}
              onChange={onChange}
            />
          ))}
        </section>
      );
    default:
      return null;
  }
}

function TableView({
  block,
  className,
  style,
}: {
  block: TableBlock;
  className?: string;
  style: React.CSSProperties;
}) {
  return (
    <div className={cn("pf-block", className)} style={style}>
      <table className="w-full border-collapse text-[0.95em]">
        <colgroup>
          {block.columns.map((column, index) => (
            <col key={index} style={{ width: `${column.width}%` }} />
          ))}
        </colgroup>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => {
                const isHeader = block.headerRow && rowIndex === 0;
                const Cell = (isHeader ? "th" : "td") as "th";
                return (
                  <Cell
                    key={cellIndex}
                    colSpan={cell.colspan}
                    rowSpan={cell.rowspan}
                    style={{ textAlign: cell.align, fontWeight: isHeader ? 600 : undefined }}
                    className="border border-current/25 px-2 py-1 align-top"
                    dangerouslySetInnerHTML={{ __html: cell.html || "" }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldStatic({
  block,
  mode,
  values,
  style,
  className,
}: {
  block: Extract<Block, { type: "field" }>;
  mode: BlockViewMode;
  values?: Record<string, unknown>;
  style: React.CSSProperties;
  className?: string;
}) {
  const { field } = block;
  const raw = readValue(values, field.key);
  const text = valueToText(raw);

  return (
    <div className={cn("pf-block", className)} style={style}>
      <div className="text-[0.85em] font-medium opacity-90">{field.label}</div>
      {mode === "static" ? (
        <div className="mt-1 min-h-[1.4em] border-b border-dotted border-current/40">
          {text ? <span>{text}</span> : null}
        </div>
      ) : (
        <div className="mt-1 min-h-[1.6em] border border-current/20 bg-current/[0.02] px-2 py-1 text-[0.95em]">
          {text ? <span>{text}</span> : <span className="opacity-40">—</span>}
        </div>
      )}
      {field.helpText ? <div className="mt-1 text-[0.75em] opacity-60">{field.helpText}</div> : null}
    </div>
  );
}
