import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Copy, FileText, MoreVertical, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError, type DocumentSummaryResponse } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function DocumentsPage() {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = React.useState<DocumentSummaryResponse[] | null>(null);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const load = React.useCallback(async () => {
    if (!workspace) return;
    try {
      const list = await api.listDocuments(workspace.id, { q: debouncedQuery || undefined });
      setDocuments(list);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not load documents");
      setDocuments([]);
    }
  }, [workspace, debouncedQuery]);

  React.useEffect(() => {
    setDocuments(null);
    void load();
  }, [load]);

  async function duplicate(id: string) {
    try {
      const copy = await api.duplicateDocument(id);
      toast.success("Duplicated");
      navigate(`/documents/${copy.id}`);
    } catch {
      toast.error("Could not duplicate");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this document?")) return;
    try {
      await api.deleteDocument(id);
      setDocuments((current) => current?.filter((document) => document.id !== id) ?? null);
      toast.success("Deleted");
    } catch {
      toast.error("Could not delete");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Documents</h1>
          <p className="text-sm text-muted-foreground">Everything you've created in {workspace?.name}.</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents…"
            className="pl-9"
          />
        </div>
      </div>

      {documents === null ? (
        <PageLoader />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={query ? "No matching documents" : "No documents yet"}
          description={query ? "Try a different search term." : "Create a blank document or start from a template."}
          action={
            <div className="flex gap-2">
              <Button onClick={() => navigate("/documents/new")}>New document</Button>
              <Button variant="outline" onClick={() => navigate("/templates")}>
                Browse templates
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <div
              key={document.id}
              className="group cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => navigate(`/documents/${document.id}`)}
            >
              <div className="mb-8 flex items-start justify-between">
                <div className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <FileText className="size-5" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Document actions"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenuItem onSelect={() => navigate(`/documents/${document.id}`)}>
                      <Pencil className="size-4" /> Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void duplicate(document.id)}>
                      <Copy className="size-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => void remove(document.id)}>
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="truncate font-medium">{document.title}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="neutral">rev {document.revision}</Badge>
                <span>{document.page_size}</span>
                <span>·</span>
                <span>Edited {relativeTime(document.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
