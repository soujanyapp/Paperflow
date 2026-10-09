import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BLOCK_CATALOG } from "@/document/registry";
import { createBlock } from "@/document/factory";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";
import type { BlockType } from "@/document/types";

const GROUP_LABEL: Record<string, string> = {
  text: "Text",
  structure: "Structure",
  media: "Media",
  form: "Forms",
};

export function AddBlockMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const insertBlock = useEditorStore((state) => state.insertBlock);
  const setEditingBlock = useEditorStore((state) => state.setEditingBlock);
  const selectedId = useEditorStore((state) => state.selectedBlockId);

  const filtered = BLOCK_CATALOG.filter((entry) => {
    const haystack = `${entry.label} ${entry.description} ${entry.keywords.join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const groups = ["text", "structure", "media", "form"] as const;

  function insert(type: BlockType) {
    const block = createBlock(type);
    insertBlock(block, selectedId ? { afterId: selectedId } : {});
    if (!["divider", "spacer", "pageBreak"].includes(type)) setEditingBlock(block.id);
    setOpen(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> Add block
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Insert a block</DialogTitle>
          <DialogDescription>Add content to your document. New blocks appear after the selected block.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search blocks…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          {groups.map((group) => {
            const entries = filtered.filter((entry) => entry.group === group);
            if (entries.length === 0) return null;
            return (
              <div key={group} className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{GROUP_LABEL[group]}</p>
                <div className="grid grid-cols-2 gap-2">
                  {entries.map((entry) => (
                    <button
                      key={entry.type}
                      type="button"
                      onClick={() => insert(entry.type)}
                      className={cn(
                        "rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50",
                      )}
                    >
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">{entry.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No blocks match “{query}”.</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
