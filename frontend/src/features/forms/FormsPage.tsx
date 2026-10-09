import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Inbox, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { useAuth } from "@/features/auth/AuthContext";
import { api, type FormResponse as FormRecord } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function FormsPage() {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = React.useState<FormRecord[] | null>(null);

  React.useEffect(() => {
    if (!workspace) return;
    setForms(null);
    api
      .listForms(workspace.id)
      .then(setForms)
      .catch(() => {
        toast.error("Could not load forms");
        setForms([]);
      });
  }, [workspace]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl">Forms</h1>
        <p className="text-sm text-muted-foreground">Publish documents as forms and track responses.</p>
      </div>

      {forms === null ? (
        <PageLoader />
      ) : forms.length === 0 ? (
        <EmptyState
          icon={<Table2 />}
          title="No published forms"
          description="Open a document, add form fields, and publish it to start collecting responses."
          action={<Button onClick={() => navigate("/")}>Go to documents</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Form</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Responses</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => {
                const title = (form.settings.title as string) || "Untitled form";
                return (
                  <tr key={form.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{title}</p>
                      <p className="font-mono text-xs text-muted-foreground">/f/{form.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={form.status === "published" ? "success" : form.status === "closed" ? "neutral" : "warning"}>
                        {form.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Inbox className="size-3.5 text-muted-foreground" /> {form.response_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{relativeTime(form.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="icon-sm" aria-label="Open public form" onClick={() => window.open(`/f/${form.slug}`, "_blank")}>
                          <ExternalLink className="size-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${form.id}`)}>
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
