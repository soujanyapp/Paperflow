import type { PaperflowDocument } from "@/document/types";

const TOKEN_KEY = "paperflow.token";
const WORKSPACE_KEY = "paperflow.workspace";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getStoredWorkspaceId(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export function setStoredWorkspaceId(id: string | null): void {
  try {
    if (id) localStorage.setItem(WORKSPACE_KEY, id);
    else localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

export const AUTH_EXPIRED_EVENT = "paperflow:auth-expired";

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "network_error", "Could not reach the Paperflow server.");
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    const envelope = (payload ?? {}) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    throw new ApiError(
      response.status,
      envelope.error?.code ?? "error",
      envelope.error?.message ?? `Request failed (${response.status})`,
      envelope.error?.details ?? {},
    );
  }

  return payload as T;
}

// --- Response shapes -------------------------------------------------------

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  created_at: string;
  role?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
  workspace: WorkspaceResponse;
}

export interface DocumentSummaryResponse {
  id: string;
  title: string;
  revision: number;
  page_size: string;
  orientation: string;
  layout: string;
  is_archived: boolean;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentResponse extends DocumentSummaryResponse {
  workspace_id: string;
  content: PaperflowDocument;
}

export interface RevisionSummaryResponse {
  id: string;
  revision_number: number;
  label: string;
  created_at: string;
  created_by_id: string | null;
}

export interface RevisionResponse extends RevisionSummaryResponse {
  content: PaperflowDocument;
}

export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  is_system: boolean;
  content: PaperflowDocument;
}

export interface AssetResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  checksum: string;
  created_at: string;
}

export interface FormResponse {
  id: string;
  document_id: string;
  revision_id: string;
  slug: string;
  status: string;
  access_mode: string;
  settings: Record<string, unknown>;
  response_count: number;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicFormResponse {
  slug: string;
  status: string;
  access_mode: string;
  settings: Record<string, unknown>;
  document_title: string;
  fields: Array<Record<string, unknown>>;
}

export interface FormResponseRecord {
  id: string;
  form_id: string;
  revision_id: string;
  submitter_email: string | null;
  data: Record<string, unknown>;
  status: string;
  created_at: string;
}

export interface PdfResponse {
  id: string;
  document_id: string;
  revision_id: string;
  response_id: string | null;
  filename: string;
  page_count: number;
  size_bytes: number;
  status: string;
  created_at: string;
}

// --- Endpoints -------------------------------------------------------------

export const api = {
  register: (input: { email: string; password: string; full_name: string }) =>
    apiFetch<TokenResponse>("/auth/register", { body: input }),
  login: (input: { email: string; password: string }) => apiFetch<TokenResponse>("/auth/login", { body: input }),
  me: () => apiFetch<UserResponse>("/auth/me"),

  listWorkspaces: () => apiFetch<WorkspaceResponse[]>("/workspaces"),
  createWorkspace: (name: string) => apiFetch<WorkspaceResponse>("/workspaces", { body: { name } }),
  listMembers: (workspaceId: string) => apiFetch<Array<Record<string, unknown>>>(`/workspaces/${workspaceId}/members`),
  listFolders: (workspaceId: string) => apiFetch<Array<Record<string, unknown>>>("/folders", { query: { workspace_id: workspaceId } }),
  createFolder: (workspaceId: string, name: string, parentId?: string | null) =>
    apiFetch<Record<string, unknown>>("/folders", { body: { name, parent_id: parentId ?? null, workspace_id: workspaceId } }),

  listDocuments: (workspaceId: string, query?: { q?: string; folder_id?: string; archived?: boolean }) =>
    apiFetch<DocumentSummaryResponse[]>("/documents", {
      query: { workspace_id: workspaceId, q: query?.q, folder_id: query?.folder_id, archived: query?.archived },
    }),
  getDocument: (id: string) => apiFetch<DocumentResponse>(`/documents/${id}`),
  createDocument: (input: { title: string; content: PaperflowDocument; workspace_id: string; folder_id?: string | null }) =>
    apiFetch<DocumentResponse>("/documents", { body: input }),
  updateDocument: (
    id: string,
    input: { content: PaperflowDocument; expected_revision?: number; create_revision?: boolean; label?: string },
  ) => apiFetch<DocumentResponse>(`/documents/${id}`, { method: "PUT", body: input }),
  duplicateDocument: (id: string) => apiFetch<DocumentResponse>(`/documents/${id}/duplicate`, { method: "POST" }),
  archiveDocument: (id: string) => apiFetch<DocumentSummaryResponse>(`/documents/${id}/archive`, { method: "POST" }),
  deleteDocument: (id: string) => apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),

  listRevisions: (id: string) => apiFetch<RevisionSummaryResponse[]>(`/documents/${id}/revisions`),
  getRevision: (id: string, revisionId: string) => apiFetch<RevisionResponse>(`/documents/${id}/revisions/${revisionId}`),
  restoreRevision: (id: string, revisionId: string) =>
    apiFetch<DocumentResponse>(`/documents/${id}/revisions/${revisionId}/restore`, { method: "POST" }),
  createRevision: (id: string, label: string) =>
    apiFetch<RevisionSummaryResponse>(`/documents/${id}/revisions`, { body: { label }, method: "POST" }),

  listTemplates: () => apiFetch<TemplateResponse[]>("/templates"),
  useTemplate: (templateId: string, workspaceId: string, folderId?: string | null) =>
    apiFetch<DocumentResponse>(`/templates/${templateId}/use`, {
      method: "POST",
      query: { workspace_id: workspaceId, folder_id: folderId },
    }),

  uploadAsset: (workspaceId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspace_id", workspaceId);
    return apiFetch<AssetResponse>("/assets", { formData });
  },
  assetUrl: (assetId: string) => `/api/assets/${assetId}/download`,

  listForms: (workspaceId: string) => apiFetch<FormResponse[]>("/forms", { query: { workspace_id: workspaceId } }),
  getForm: (id: string) => apiFetch<FormResponse>(`/forms/${id}`),
  publishForm: (
    documentId: string,
    input: { settings: Record<string, unknown>; access_mode: string; status: string; password?: string | null },
  ) => apiFetch<FormResponse>("/forms/publish", { method: "POST", query: { document_id: documentId }, body: input }),
  listResponses: (formId: string) => apiFetch<FormResponseRecord[]>(`/forms/${formId}/responses`),
  generateResponsePdf: (formId: string, responseId: string) =>
    apiFetch<PdfResponse>(`/forms/${formId}/responses/${responseId}/pdf`, { method: "POST" }),

  getPublicForm: (slug: string) => apiFetch<PublicFormResponse>(`/forms/public/${slug}`),
  submitPublicForm: (slug: string, values: Record<string, unknown>, email?: string) =>
    apiFetch<{ id: string; success_message: string }>(`/forms/public/${slug}/submit`, {
      body: { values, email: email ?? null },
    }),

  generateDocumentPdf: (documentId: string, values: Record<string, unknown> = {}, filename?: string) =>
    apiFetch<PdfResponse>(`/pdf/documents/${documentId}`, { method: "POST", body: { values, filename }, query: {} }),

  downloadUrl: (pdfId: string) => `/api/pdf/${pdfId}/download`,
};

export async function downloadPdf(pdfId: string, filename: string): Promise<void> {
  const token = getToken();
  const response = await fetch(api.downloadUrl(pdfId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError(response.status, "download_failed", "Could not download the PDF.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
