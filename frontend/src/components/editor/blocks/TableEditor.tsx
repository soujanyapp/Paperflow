import * as React from "react";
import { Columns3, Rows3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { TableBlock } from "@/document/types";

export function TableEditor({ block, onChange }: { block: TableBlock; onChange: (mutator: (draft: TableBlock) => void) => void }) {
  const cellRef = React.useRef<HTMLTableCellElement | null>(null);
  const cols = block.columns.length;

  const setCell = (row: number, col: number, html: string) =>
    onChange((draft) => {
      draft.rows[row][col].html = html;
    });

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {block.columns.map((column, index) => (
              <col key={index} style={{ width: `${column.width}%` }} />
            ))}
          </colgroup>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => {
                  const isHeader = block.headerRow && rowIndex === 0;
                  return (
                    <td key={colIndex} className="border border-border p-0 align-top">
                      <div
                        ref={colIndex === 0 && rowIndex === 0 ? cellRef : undefined}
                        contentEditable
                        suppressContentEditableWarning
                        role="textbox"
                        className="min-h-8 px-2 py-1 text-sm outline-none focus:bg-accent/40"
                        style={{ fontWeight: isHeader ? 600 : undefined }}
                        dangerouslySetInnerHTML={{ __html: cell.html || "" }}
                        onBlur={(event) => setCell(rowIndex, colIndex, event.currentTarget.innerHTML)}
                      />
                    </td>
                  );
                })}
                <td className="w-7 border-0 p-0 align-middle">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete row"
                    disabled={block.rows.length <= 1}
                    onClick={() =>
                      onChange((draft) => {
                        draft.rows.splice(rowIndex, 1);
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            onChange((draft) => {
              draft.rows.push(Array.from({ length: draft.columns.length }, () => ({ html: "" })));
            })
          }
        >
          <Rows3 className="size-3.5" /> Add row
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            onChange((draft) => {
              draft.columns.push({ width: Math.max(5, Math.round(100 / (draft.columns.length + 1))) });
              draft.rows.forEach((row) => row.push({ html: "" }));
            })
          }
        >
          <Columns3 className="size-3.5" /> Add column
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive"
          disabled={cols <= 1}
          onClick={() =>
            onChange((draft) => {
              draft.columns.pop();
              draft.rows.forEach((row) => row.pop());
            })
          }
        >
          <Trash2 className="size-3.5" /> Remove column
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Header row
          <Switch
            checked={block.headerRow}
            onCheckedChange={(checked) =>
              onChange((draft) => {
                draft.headerRow = checked;
              })
            }
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Click any cell to edit. Cells accept simple formatting when pasted.</p>
    </div>
  );
}
