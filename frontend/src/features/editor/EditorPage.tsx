import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { DocumentCanvas } from "@/components/editor/DocumentCanvas";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { OutlinePanel } from "@/components/editor/OutlinePanel";
import { Inspector } from "@/components/editor/Inspector";
import { PageLoader } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { coerceDocument } from "@/document/schema";
import { useAutosave } from "@/hooks/useAutosave";
import { useEditorStore } from "@/store/editorStore";

export function EditorPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const previewMode = useEditorStore((state) => state.previewMode);
  const setDocument = useEditorStore((state) => state.setDocument);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const { saveNow } = useAutosave(documentId, !loading);

  React.useEffect(() => {
    let cancelled = false;
    if (!documentId) return;
    setLoading(true);
    setLoadError(null);
    api
      .getDocument(documentId)
      .then((response) => {
        if (cancelled) return;
        const content = coerceDocument(response.content);
        setDocument(content, { resetHistory: true });
        useEditorStore.setState({ serverRevision: response.revision, saveStatus: "idle", lastSavedAt: response.updated_at });
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : "Could not load document";
        setLoadError(message);
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
          toast.error(message);
          navigate("/", { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, navigate, setDocument]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) useEditorStore.getState().redo();
        else useEditorStore.getState().undo();
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow]);

  React.useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (useEditorStore.getState().saveStatus === "dirty") event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (loading) {
    return (
      <div className="grid h-screen place-items-center">
        <PageLoader label="Opening document" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="grid h-screen place-items-center text-sm text-muted-foreground">{loadError}</div>
    );
  }

  if (!documentId) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <EditorToolbar documentId={documentId} saveNow={saveNow} />
      <div className="flex min-h-0 flex-1">
        {!previewMode ? (
          <aside className="hidden w-60 shrink-0 border-r border-border bg-background lg:block">
            <OutlinePanel />
          </aside>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto bg-canvas">
          {previewMode ? <PreviewCanvas /> : <DocumentCanvas />}
        </div>

        {!previewMode ? (
          <aside className="hidden w-80 shrink-0 border-l border-border bg-background xl:block">
            <Inspector />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
