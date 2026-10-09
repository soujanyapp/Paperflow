import * as React from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError, type FormResponse } from "@/lib/api";
import { collectFields } from "@/document/types";
import { useEditorStore } from "@/store/editorStore";

export function PublishFormDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const document = useEditorStore((state) => state.document);
  const fieldCount = collectFields(document.blocks).length;

  const [title, setTitle] = React.useState(document.title);
  const [description, setDescription] = React.useState("");
  const [submitLabel, setSubmitLabel] = React.useState("Submit");
  const [successMessage, setSuccessMessage] = React.useState("Thanks — your response has been recorded.");
  const [accessMode, setAccessMode] = React.useState("public");
  const [collectEmail, setCollectEmail] = React.useState(false);
  const [allowMultiple, setAllowMultiple] = React.useState(true);
  const [publishing, setPublishing] = React.useState(false);
  const [published, setPublished] = React.useState<FormResponse | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle(document.title);
      setPublished(null);
    }
  }, [open, document.title]);

  const shareUrl = published ? `${window.location.origin}/f/${published.slug}` : "";

  async function publish() {
    setPublishing(true);
    try {
      const result = await api.publishForm(documentId, {
        settings: {
          title,
          description,
          submitLabel,
          successMessage,
          allowMultiple,
          requireAuth: accessMode === "authenticated",
          collectEmail,
        },
        access_mode: accessMode,
        status: "published",
      });
      setPublished(result);
      toast.success("Form published");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not publish form");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish as a form</DialogTitle>
          <DialogDescription>
            {fieldCount > 0
              ? `Collect responses using the ${fieldCount} form field${fieldCount === 1 ? "" : "s"} in this document.`
              : "This document has no form fields yet. Add a Form field block to collect responses."}
          </DialogDescription>
        </DialogHeader>

        {published ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <p className="text-sm font-medium">Your form is live</p>
              <p className="text-xs text-muted-foreground">Share this link to collect responses.</p>
              <div className="mt-2 flex items-center gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(shareUrl, "_blank")}>
                  <ExternalLink className="size-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Form title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} rows={2} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Submit button</Label>
                <Input value={submitLabel} onChange={(event) => setSubmitLabel(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Access</Label>
                <Select value={accessMode} onValueChange={setAccessMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Anyone with the link</SelectItem>
                    <SelectItem value="authenticated">Signed-in users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Success message</Label>
              <Input value={successMessage} onChange={(event) => setSuccessMessage(event.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              Collect respondent email
              <Switch checked={collectEmail} onCheckedChange={setCollectEmail} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              Allow multiple submissions
              <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={publish} loading={publishing}>
                Publish form
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
