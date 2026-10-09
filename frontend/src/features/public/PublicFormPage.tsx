import * as React from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/feedback";
import { Logo } from "@/components/layout/Logo";
import { FieldControl } from "@/components/forms/FieldControl";
import { api, ApiError, type PublicFormResponse } from "@/lib/api";
import type { FieldDefinition } from "@/document/types";

export function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = React.useState<PublicFormResponse | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "missing" | "submitted">("loading");
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");

  React.useEffect(() => {
    if (!slug) return;
    api
      .getPublicForm(slug)
      .then((data) => {
        setForm(data);
        setStatus("ready");
      })
      .catch(() => setStatus("missing"));
  }, [slug]);

  const fields = (form?.fields as unknown as FieldDefinition[]) ?? [];

  function setValue(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!slug || !form) return;

    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const value = values[field.key];
      const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      if (field.required && empty) nextErrors[field.key] = "This field is required";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.submitPublicForm(slug, values);
      setSuccessMessage(result.success_message || String(form.settings.successMessage ?? "Thanks!"));
      setStatus("submitted");
    } catch (error) {
      if (error instanceof ApiError && error.details?.fields) {
        setErrors(error.details.fields as Record<string, string>);
      } else {
        setErrors({ _form: error instanceof ApiError ? error.message : "Submission failed" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <PageLoader label="Loading form" />
      </div>
    );
  }

  if (status === "missing" || !form) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-3 pt-6">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="font-medium">Form not available</p>
            <p className="text-sm text-muted-foreground">This form may have been closed or the link is incorrect.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = (form.settings.title as string) || form.document_title;

  return (
    <div className="min-h-screen bg-canvas py-10">
      <div className="mx-auto w-full max-w-2xl px-4">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="font-serif text-2xl">{title}</CardTitle>
            {form.settings.description ? (
              <p className="text-sm text-muted-foreground">{String(form.settings.description)}</p>
            ) : null}
          </CardHeader>
          <CardContent className="pt-5">
            {status === "submitted" ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="size-10 text-[var(--success)]" />
                <p className="font-medium">Response recorded</p>
                <p className="max-w-sm text-sm text-muted-foreground">{successMessage}</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                {fields.map((field) => (
                  <FieldControl
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    onChange={(value) => setValue(field.key, value)}
                    error={errors[field.key] ?? null}
                  />
                ))}
                {errors._form ? <p className="text-sm text-destructive">{errors._form}</p> : null}
                <Button type="submit" className="w-full" loading={submitting}>
                  {String(form.settings.submitLabel ?? "Submit")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Powered by Paperflow</p>
      </div>
    </div>
  );
}
