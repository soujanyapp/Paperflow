import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/feedback";
import { useAuth } from "@/features/auth/AuthContext";
import { createEmptyDocument } from "@/document/factory";
import { api, ApiError } from "@/lib/api";

export function NewDocumentPage() {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const templateId = params.get("template");
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!workspace || started.current) return;
    started.current = true;

    (async () => {
      try {
        if (templateId) {
          const document = await api.useTemplate(templateId, workspace.id);
          navigate(`/documents/${document.id}`, { replace: true });
        } else {
          const document = await api.createDocument({
            title: "Untitled document",
            content: createEmptyDocument(),
            workspace_id: workspace.id,
          });
          navigate(`/documents/${document.id}`, { replace: true });
        }
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Could not create document");
        navigate("/", { replace: true });
      }
    })();
  }, [workspace, templateId, navigate]);

  return (
    <div className="grid min-h-[50vh] place-items-center">
      <PageLoader label="Creating document" />
    </div>
  );
}
