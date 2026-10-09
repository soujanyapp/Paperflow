import { Copy, Eye, EyeOff, GripVertical, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { BlockView } from "@/components/document/BlockView";
import { EditableBlock } from "@/components/editor/EditableBlock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createBlock } from "@/document/factory";
import { api } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";
import type { Block } from "@/document/types";

export function BlockSlot({ block, parentId = null }: { block: Block; parentId?: string | null }) {
  const theme = useEditorStore((state) => state.document.theme);
  const selectedId = useEditorStore((state) => state.selectedBlockId);
  const editingId = useEditorStore((state) => state.editingBlockId);
  const selectBlock = useEditorStore((state) => state.selectBlock);
  const setEditingBlock = useEditorStore((state) => state.setEditingBlock);
  const removeBlock = useEditorStore((state) => state.removeBlock);
  const duplicateBlock = useEditorStore((state) => state.duplicateBlock);
  const insertBlock = useEditorStore((state) => state.insertBlock);
  const updateBlockById = useEditorStore((state) => state.updateBlockById);

  const selected = selectedId === block.id;
  const editing = editingId === block.id && !block.locked;

  return (
    <div
      data-block-id={block.id}
      className={cn(
        "group/slot relative -mx-4 my-1 rounded-[4px] px-4 py-1 transition-shadow",
        !block.hidden && "hover:ring-1 hover:ring-primary/25",
        selected && "ring-1 ring-primary/70",
        block.hidden && "opacity-40",
      )}
      onMouseDown={(event) => {
        if (editing) return;
        event.stopPropagation();
        selectBlock(block.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!block.locked) setEditingBlock(block.id);
      }}
    >
      <span className="pointer-events-none absolute -left-7 top-2 hidden text-muted-foreground group-hover/slot:block">
        <GripVertical className="size-4" />
      </span>

      {block.hidden ? (
        <div className="absolute left-1 top-1 z-10 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Hidden
        </div>
      ) : null}

      {editing ? (
        <EditableBlock block={block} renderSlot={(child) => <BlockSlot key={child.id} block={child} parentId={block.id} />} />
      ) : (
        <BlockView block={block} theme={theme} assetUrl={api.assetUrl} />
      )}

      {(selected || editing) && (
        <div className="absolute -right-2 -top-3 z-20 flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md">
          <Button
            variant="ghost"
            size="icon-sm"
            title={block.hidden ? "Show block" : "Hide block"}
            onClick={(event) => {
              event.stopPropagation();
              updateBlockById(block.id, (draft) => {
                draft.hidden = !draft.hidden;
              });
            }}
          >
            {block.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={block.locked ? "Unlock block" : "Lock block"}
            onClick={(event) => {
              event.stopPropagation();
              updateBlockById(block.id, (draft) => {
                draft.locked = !draft.locked;
              });
            }}
          >
            {block.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Duplicate"
            onClick={(event) => {
              event.stopPropagation();
              duplicateBlock(block.id);
            }}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Delete"
            className="text-destructive hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              removeBlock(block.id);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}

      {selected && !editing ? (
        <button
          type="button"
          className="absolute -bottom-2.5 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-popover px-2 py-0.5 text-xs text-muted-foreground shadow-sm hover:text-foreground group-hover/slot:flex"
          onClick={(event) => {
            event.stopPropagation();
            const created = createBlock("paragraph");
            insertBlock(created, parentId ? { parentId } : { afterId: block.id });
            setEditingBlock(created.id);
          }}
        >
          <Plus className="size-3" /> Add block
        </button>
      ) : null}
    </div>
  );
}
