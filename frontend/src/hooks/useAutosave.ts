import * as React from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";

const DEBOUNCE_MS = 900;

export function useAutosave(documentId: string | undefined, enabled: boolean) {
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const timer = React.useRef<number | null>(null);
  const inflight = React.useRef<Promise<void> | null>(null);

  const saveNow = React.useCallback(async () => {
    if (!documentId) return;
    if (inflight.current) return inflight.current;
    const state = useEditorStore.getState();
    if (state.saveStatus !== "dirty") return;

    const task = (async () => {
      state.markSaving();
      try {
        const response = await api.updateDocument(documentId, {
          content: state.document,
          expected_revision: state.serverRevision,
        });
        useEditorStore.getState().markSaved({ revision: response.revision, savedAt: response.updated_at });
      } catch (error) {
        const store = useEditorStore.getState();
        if (error instanceof ApiError && error.isConflict) {
          toast.error("This document changed on the server. Reload to get the latest version.");
          store.markSaveError("conflict");
        } else {
          store.markSaveError(error instanceof Error ? error.message : "Save failed");
        }
      } finally {
        inflight.current = null;
      }
    })();

    inflight.current = task;
    return task;
  }, [documentId]);

  React.useEffect(() => {
    if (!enabled || !documentId) return;
    if (saveStatus !== "dirty") return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveNow(), DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [saveStatus, enabled, documentId, saveNow]);

  React.useEffect(() => {
    const onUnload = () => {
      if (useEditorStore.getState().saveStatus === "dirty") void saveNow();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [saveNow]);

  return { saveNow };
}
