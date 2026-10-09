import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Block, PaperflowDocument } from "@/document/types";
import { createEmptyDocument, duplicateDocument } from "@/document/factory";
import type { Theme } from "@/document/types";
import { insertBlock as insertBlockOp, moveTopLevelBlock, removeBlock, duplicateBlock } from "@/document/operations";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export type DevicePreview = "desktop" | "tablet" | "mobile";

export interface EditOptions {
  /** Whether this edit creates an undo checkpoint. Defaults to true. */
  history?: boolean;
  /** Consecutive edits sharing a group within the debounce window coalesce. */
  group?: string;
}

export interface EditorState {
  document: PaperflowDocument;
  selectedBlockId: string | null;
  editingBlockId: string | null;
  past: PaperflowDocument[];
  future: PaperflowDocument[];
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  serverRevision: number;
  zoom: number;
  previewMode: boolean;
  devicePreview: DevicePreview;
  lastGroup: string | null;
  lastGroupTime: number;

  setDocument: (doc: PaperflowDocument, options?: { resetHistory?: boolean }) => void;
  setTitle: (title: string) => void;
  edit: (mutator: (draft: PaperflowDocument) => void, options?: EditOptions) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  selectBlock: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;

  insertBlock: (block: Block, options?: { beforeId?: string; afterId?: string; index?: number; parentId?: string }) => void;
  removeBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (id: string, toIndex: number) => void;
  updateBlockById: (id: string, mutator: (block: Block) => void, options?: EditOptions) => void;
  updateSelected: (mutator: (block: Block) => void, options?: EditOptions) => void;

  setTheme: (theme: Theme) => void;
  setZoom: (zoom: number) => void;
  setPreviewMode: (value: boolean) => void;
  setDevicePreview: (device: DevicePreview) => void;

  markSaving: () => void;
  markSaved: (options: { revision: number; savedAt: string }) => void;
  markSaveError: (message: string) => void;
  duplicateCurrent: () => void;
}

const HISTORY_LIMIT = 60;
const GROUP_WINDOW_MS = 700;

function selectExisting(doc: PaperflowDocument, id: string | null): string | null {
  if (!id) return null;
  const stack: Block[] = [...doc.blocks];
  while (stack.length) {
    const block = stack.pop()!;
    if (block.id === id) return id;
    if (block.type === "section" || block.type === "repeater") stack.push(...block.blocks);
  }
  return null;
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    document: createEmptyDocument(),
    selectedBlockId: null,
    editingBlockId: null,
    past: [],
    future: [],
    saveStatus: "idle",
    saveError: null,
    lastSavedAt: null,
    serverRevision: 0,
    zoom: 1,
    previewMode: false,
    devicePreview: "desktop",
    lastGroup: null,
    lastGroupTime: 0,

    setDocument: (doc, options) =>
      set((state) => {
        state.document = doc;
        state.selectedBlockId = null;
        state.editingBlockId = null;
        state.saveStatus = "idle";
        state.saveError = null;
        if (options?.resetHistory) {
          state.past = [];
          state.future = [];
        }
      }),

    setTitle: (title) =>
      set((state) => {
        state.document.title = title;
        state.document.meta.updatedAt = new Date().toISOString();
        state.saveStatus = "dirty";
      }),

    edit: (mutator, options = {}) => {
      const history = options.history ?? true;
      const group = options.group;
      const now = Date.now();
      const prev = get().document;
      const shouldCheckpoint =
        history && !(group && group === get().lastGroup && now - get().lastGroupTime < GROUP_WINDOW_MS);

      set((state) => {
        mutator(state.document);
        state.document.meta.updatedAt = new Date().toISOString();
        state.saveStatus = "dirty";
        state.saveError = null;
      });

      if (shouldCheckpoint) {
        set((state) => {
          state.past = [...state.past, prev].slice(-HISTORY_LIMIT);
          state.future = [];
        });
      }
      set((state) => {
        state.lastGroup = group ?? null;
        state.lastGroupTime = now;
      });
    },

    undo: () =>
      set((state) => {
        if (state.past.length === 0) return;
        const previous = state.past[state.past.length - 1];
        state.future = [state.document, ...state.future].slice(0, HISTORY_LIMIT);
        state.past = state.past.slice(0, -1);
        state.document = previous;
        state.selectedBlockId = selectExisting(previous, state.selectedBlockId);
        state.editingBlockId = null;
        state.saveStatus = "dirty";
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0) return;
        const next = state.future[0];
        state.past = [...state.past, state.document].slice(-HISTORY_LIMIT);
        state.future = state.future.slice(1);
        state.document = next;
        state.selectedBlockId = selectExisting(next, state.selectedBlockId);
        state.editingBlockId = null;
        state.saveStatus = "dirty";
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    selectBlock: (id) =>
      set((state) => {
        state.selectedBlockId = id;
        if (state.editingBlockId && state.editingBlockId !== id) state.editingBlockId = null;
      }),

    setEditingBlock: (id) =>
      set((state) => {
        state.editingBlockId = id;
        if (id) state.selectedBlockId = id;
      }),

    insertBlock: (block, options) =>
      get().edit((doc) => {
        insertBlockOp(doc, block, options);
      }),

    removeBlock: (id) =>
      get().edit((doc) => {
        removeBlock(doc, id);
      }),

    duplicateBlock: (id) =>
      get().edit((doc) => {
        duplicateBlock(doc, id);
      }),

    moveBlock: (id, toIndex) =>
      get().edit((doc) => {
        moveTopLevelBlock(doc, id, toIndex);
      }),

    updateBlockById: (id, mutator, options) =>
      get().edit((doc) => {
        const stack: Block[] = [...doc.blocks, ...(doc.header.blocks as Block[]), ...(doc.footer.blocks as Block[])];
        let found: Block | undefined;
        while (stack.length) {
          const block = stack.pop()!;
          if (block.id === id) {
            found = block;
            break;
          }
          if (block.type === "section" || block.type === "repeater") stack.push(...block.blocks);
        }
        if (found) mutator(found);
      }, options),

    updateSelected: (mutator, options) => {
      const id = get().selectedBlockId;
      if (!id) return;
      get().updateBlockById(id, mutator, options);
    },

    setTheme: (theme) =>
      get().edit((doc) => {
        doc.theme = theme;
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = Math.max(0.25, Math.min(2, zoom));
      }),

    setPreviewMode: (value) =>
      set((state) => {
        state.previewMode = value;
      }),

    setDevicePreview: (device) =>
      set((state) => {
        state.devicePreview = device;
      }),

    markSaving: () =>
      set((state) => {
        state.saveStatus = "saving";
        state.saveError = null;
      }),

    markSaved: ({ revision, savedAt }) =>
      set((state) => {
        state.saveStatus = "saved";
        state.serverRevision = revision;
        state.lastSavedAt = savedAt;
        state.saveError = null;
      }),

    markSaveError: (message) =>
      set((state) => {
        state.saveStatus = "error";
        state.saveError = message;
      }),

    duplicateCurrent: () =>
      set((state) => {
        state.document = duplicateDocument(state.document);
        state.past = [];
        state.future = [];
        state.selectedBlockId = null;
        state.editingBlockId = null;
        state.saveStatus = "dirty";
      }),
  })),
);

export function useSelectedBlock(): Block | null {
  return useEditorStore((state) => {
    const id = state.selectedBlockId;
    if (!id) return null;
    const stack: Block[] = [...state.document.blocks];
    while (stack.length) {
      const block = stack.pop()!;
      if (block.id === id) return block;
      if (block.type === "section" || block.type === "repeater") stack.push(...block.blocks);
    }
    return null;
  });
}
