import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Download, ExternalLink, FileText, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { api, ApiError, downloadPdf, type FormResponseRecord, type FormResponse as FormRecord, type PublicFormResponse } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export function FormDetailPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = React.useState<FormRecord | null>(null);
  const [publicForm, setPublicForm] = React.useState<PublicFormResponse | null>(null);
  const [responses, setResponses] = React.useState<FormResponseRecord[] | null>(null);
  const [exportingId, setExportingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!formId) return;
    Promise.all([api.getForm(formId), api.listResponses(formId)])
      .then(([formData, responseData]) => {
        setForm(formData);
        setResponses(responseData);
        return api.getPublicForm(formData.slug).catch(() => null);
      })
      .then((publicData) => setPublicForm(publicData))
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "Could not load form");
        setResponses([]);
      });
  }, [formId]);

  const shareUrl = form ? `${window.location.origin}/f/${form.slug}` : "";

  const labelByKey = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const field of publicForm?.fields ?? []) {
      const key = String(field.key ?? "");
      if (key) map.set(key, String(field.label ?? key));
    }
    return map;
  }, [publicForm]);

  const columns = React.useMemo(() => {
    const keys = new Set<string>();
    for (const response of responses ?? []) {
      for (const key of Object.keys(response.data)) keys.add(key);
    }
    return [...keys];
  }, [responses]);

  async function exportPdf(response: FormResponseRecord) {
    if (!form) return;
    setExportingId(response.id);
    try {
      const pdf = await api.generateResponsePdf(form.id, response.id);
      await downloadPdf(pdf.id, pdf.filename);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Export failed");
    } finally {
      setExportingId(null);
    }
  }

  if (!form) return <PageLoader label="Loading form" />;

  const title = (form.settings.title as string) || "Untitled form";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/forms")} aria-label="Back to forms">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl">{title}</h1>
              <Badge variant={form.status === "published" ? "success" : "neutral"}>{form.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {(form.settings.description as string) || "Published form"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/documents/${form.document_id}`)}>
            <FileText className="size-3.5" /> Source document
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(shareUrl, "_blank")}>
            <ExternalLink className="size-3.5" /> Open form
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              toast.success("Link copied");
            }}
          >
            <Copy className="size-3.5" /> Copy link
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl">{form.response_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg capitalize">{form.access_mode}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Last updated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{formatDateTime(form.updated_at)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Responses</h2>
        {responses === null ? (
          <PageLoader />
        ) : responses.length === 0 ? (
          <EmptyState icon={<Inbox />} title="No responses yet" description="Share the form link to start collecting answers." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Submitted</th>
                  {columns.map((key) => (
                    <th key={key} className="whitespace-nowrap px-4 py-2.5 font-medium">
                      {labelByKey.get(key) ?? key}
                    </th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {responses.map((response) => (
                  <tr key={response.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(response.created_at)}</td>
                    {columns.map((key) => (
                      <td key={key} className="max-w-[240px] truncate px-4 py-3">
                        {renderValue(response.data[key])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        loading={exportingId === response.id}
                        onClick={() => exportPdf(response)}
                      >
                        <Download className="size-3.5" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
