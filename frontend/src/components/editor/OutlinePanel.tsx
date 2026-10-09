import {
  AlignLeft,
  Hash,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  MoveVertical,
  Repeat,
  ScanLine,
  SquareSplitVertical,
  Table2,
  Type,
  TextCursorInput,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Block, BlockType } from "@/document/types";
import { labelForBlock, stripHtml } from "@/document/registry";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";

const ICONS: Record<BlockType, React.ReactNode> = {
  heading: <Type className="size-3.5" />,
  paragraph: <AlignLeft className="size-3.5" />,
  bulletedList: <List className="size-3.5" />,
  numberedList: <ListOrdered className="size-3.5" />,
  table: <Table2 className="size-3.5" />,
  image: <ImageIcon className="size-3.5" />,
  divider: <Minus className="size-3.5" />,
  spacer: <MoveVertical className="size-3.5" />,
  pageBreak: <SquareSplitVertical className="size-3.5" />,
  signature: <ScanLine className="size-3.5" />,
  field: <TextCursorInput className="size-3.5" />,
  section: <Hash className="size-3.5" />,
  repeater: <Repeat className="size-3.5" />,
};

export function OutlinePanel() {
  const blocks = useEditorStore((state) => state.document.blocks);
  const moveBlock = useEditorStore((state) => state.moveBlock);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const targetIndex = blocks.findIndex((block) => block.id === over.id);
    if (targetIndex >= 0) moveBlock(String(active.id), targetIndex);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Outline</span>
        <span className="text-xs text-muted-foreground">{blocks.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block, index) => (
              <OutlineRow key={block.id} block={block} index={index} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function OutlineRow({ block, index }: { block: Block; index: number }) {
  const selectedId = useEditorStore((state) => state.selectedBlockId);
  const selectBlock = useEditorStore((state) => state.selectBlock);
  const setEditingBlock = useEditorStore((state) => state.setEditingBlock);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const selected = selectedId === block.id;
  const label = labelForBlock(block);
  const secondary = block.type === "paragraph" ? stripHtml(block.html).slice(0, 40) : "";

  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        selected ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-secondary",
        isDragging && "opacity-60",
      )}
      onClick={() => selectBlock(block.id)}
      onDoubleClick={() => {
        selectBlock(block.id);
        setEditingBlock(block.id);
      }}
      {...attributes}
      {...listeners}
    >
      <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{index + 1}</span>
      <span className={cn("shrink-0", selected ? "text-primary" : "text-muted-foreground")}>{ICONS[block.type]}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {block.hidden ? <span className="text-[10px] text-muted-foreground">hidden</span> : null}
      {secondary ? <span className="hidden truncate text-[10px] text-muted-foreground/60 xl:inline">{secondary}</span> : null}
    </button>
  );
}
