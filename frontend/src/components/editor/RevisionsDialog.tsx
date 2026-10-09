import * as React from "react";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { api, ApiError, type RevisionSummaryResponse } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useEditorStore } from "@/store/editorStore";
import { coerceDocument } from "@/document/schema";

export function RevisionsDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [revisions, setRevisions] = React.useState<RevisionSummaryResponse[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const setDocument = useEditorStore((state) => state.setDocument);
  const serverRevision = useEditorStore((state) => state.serverRevision);

  const load = React.useCallback(async () => {
    setRevisions(null);
    try {
      setRevisions(await api.listRevisions(documentId));
    } catch {
      setRevisions([]);
    }
  }, [documentId]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function checkpoint() {
    try {
      await api.createRevision(documentId, "Manual checkpoint");
      toast.success("Checkpoint created");
      void load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create checkpoint");
    }
  }

  async function restore(revisionId: string) {
    setBusyId(revisionId);
    try {
      const document = await api.restoreRevision(documentId, revisionId);
      const content = coerceDocument(document.content);
      setDocument(content, { resetHistory: true });
      useEditorStore.setState({ serverRevision: document.revision, saveStatus: "saved" });
      toast.success("Revision restored");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Restore failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>Restore a previous version or create a named checkpoint.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={checkpoint}>
            Create checkpoint
          </Button>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {revisions === null ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Spinner />
            </div>
          ) : revisions.length === 0 ? (
            <EmptyState icon={<History />} title="No revisions yet" description="Checkpoints appear here as you edit." />
          ) : (
            revisions.map((revision) => (
              <div key={revision.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">
                    {revision.label || `Revision ${revision.revision_number}`}
                    {revision.revision_number === serverRevision ? (
                      <span className="ml-2 text-xs text-[var(--success)]">current</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(revision.created_at)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={busyId === revision.id || revision.revision_number === serverRevision}
                  onClick={() => restore(revision.id)}
                >
                  <RotateCcw className="size-3.5" /> Restore
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
