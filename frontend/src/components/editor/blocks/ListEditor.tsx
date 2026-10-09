import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListBlock } from "@/document/types";

export function ListEditor({ block, onChange }: { block: ListBlock; onChange: (mutator: (draft: ListBlock) => void) => void }) {
  const update = (index: number, value: string) =>
    onChange((draft) => {
      draft.items[index] = value;
    });

  return (
    <div className="space-y-1.5">
      {block.items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-right text-sm text-muted-foreground">{block.type === "numberedList" ? `${index + 1}.` : "•"}</span>
          <Input
            value={item}
            onChange={(event) => update(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onChange((draft) => {
                  draft.items.splice(index + 1, 0, "");
                });
              }
              if (event.key === "Backspace" && item === "" && block.items.length > 1) {
                event.preventDefault();
                onChange((draft) => {
                  draft.items.splice(index, 1);
                });
              }
            }}
            className="h-8"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              onChange((draft) => {
                draft.items.splice(index, 1);
              })
            }
            disabled={block.items.length <= 1}
            aria-label="Remove item"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onChange((draft) => draft.items.push(""))}>
        <Plus className="size-3.5" /> Add item
      </Button>
    </div>
  );
}
