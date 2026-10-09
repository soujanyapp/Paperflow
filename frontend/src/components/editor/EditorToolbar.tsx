import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Cloud,
  Download,
  Eye,
  FileClock,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddBlockMenu } from "@/components/editor/AddBlockMenu";
import { PublishFormDialog } from "@/features/forms/PublishFormDialog";
import { RevisionsDialog } from "@/components/editor/RevisionsDialog";
import { api, ApiError, downloadPdf } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";
import type { SaveStatus } from "@/store/editorStore";

function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt: string | null }) {
  const map: Record<SaveStatus, { label: string; className: string; icon: React.ReactNode }> = {
    idle: { label: savedAt ? `Saved ${relativeTime(savedAt)}` : "Ready", className: "text-muted-foreground", icon: <Cloud className="size-3.5" /> },
    dirty: { label: "Unsaved changes", className: "text-[var(--warning)]", icon: <Cloud className="size-3.5" /> },
    saving: { label: "Saving…", className: "text-muted-foreground", icon: <Cloud className="size-3.5 animate-pulse" /> },
    saved: { label: "All changes saved", className: "text-[var(--success)]", icon: <Check className="size-3.5" /> },
    error: { label: "Save failed", className: "text-destructive", icon: <Cloud className="size-3.5" /> },
  };
  const entry = map[status];
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", entry.className)}>
      {entry.icon}
      {entry.label}
    </span>
  );
}

export function EditorToolbar({
  documentId,
  saveNow,
}: {
  documentId: string;
  saveNow: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const title = useEditorStore((state) => state.document.title);
  const setTitle = useEditorStore((state) => state.setTitle);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const previewMode = useEditorStore((state) => state.previewMode);
  const setPreviewMode = useEditorStore((state) => state.setPreviewMode);

  const [publishOpen, setPublishOpen] = React.useState(false);
  const [revisionsOpen, setRevisionsOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  async function onExport() {
    setExporting(true);
    try {
      await saveNow();
      const pdf = await api.generateDocumentPdf(documentId, {});
      await downloadPdf(pdf.id, pdf.filename);
      toast.success(`Exported ${pdf.page_count} page${pdf.page_count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    try {
      await api.deleteDocument(documentId);
      toast.success("Document deleted");
      navigate("/");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    }
  }

  return (
    <div className="flex h-14 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to documents">
            <ArrowLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back to documents</TooltipContent>
      </Tooltip>

      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="h-8 max-w-xs border-transparent bg-transparent px-2 text-sm font-medium shadow-none hover:border-input focus-visible:border-input"
        aria-label="Document title"
      />

      <SaveIndicator status={saveStatus} savedAt={lastSavedAt} />

      <div className="mx-auto flex items-center gap-2">
        <div className="flex items-center rounded-md border border-border p-0.5">
          <Button
            variant={!previewMode ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setPreviewMode(false)}
          >
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button
            variant={previewMode ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setPreviewMode(true)}
          >
            <Eye className="size-3.5" /> Preview
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border px-1">
          <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={undo} aria-label="Undo">
            <Undo2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={redo} aria-label="Redo">
            <Redo2 className="size-3.5" />
          </Button>
        </div>

        <div className="hidden items-center gap-1 rounded-md border border-border px-1 md:flex">
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom out">
            <Minus className="size-3.5" />
          </Button>
          <button className="w-11 text-center text-xs tabular-nums text-muted-foreground" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom in">
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <AddBlockMenu />

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPublishOpen(true)}>
          <Send className="size-3.5" /> Publish
        </Button>

        <Button size="sm" className="gap-1.5" loading={exporting} onClick={onExport}>
          <Download className="size-3.5" /> Export PDF
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Document</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setRevisionsOpen(true)}>
              <FileClock className="size-4" /> Version history
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  const copy = await api.duplicateDocument(documentId);
                  toast.success("Duplicated");
                  navigate(`/documents/${copy.id}`);
                } catch {
                  toast.error("Could not duplicate");
                }
              }}
            >
              <Plus className="size-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="size-4" /> Delete document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <PublishFormDialog documentId={documentId} open={publishOpen} onOpenChange={setPublishOpen} />
      <RevisionsDialog documentId={documentId} open={revisionsOpen} onOpenChange={setRevisionsOpen} />
    </div>
  );
}
