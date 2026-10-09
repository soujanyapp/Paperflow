import * as React from "react";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { BlockView } from "@/components/document/BlockView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { pageBox, themeCss } from "@/document/styles";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError, type TemplateResponse } from "@/lib/api";

export function TemplatesPage() {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = React.useState<TemplateResponse[] | null>(null);
  const [category, setCategory] = React.useState<string | null>(null);
  const [usingId, setUsingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .listTemplates()
      .then(setTemplates)
      .catch(() => {
        toast.error("Could not load templates");
        setTemplates([]);
      });
  }, []);

  const categories = React.useMemo(() => {
    if (!templates) return [];
    return [...new Set(templates.map((template) => template.category))];
  }, [templates]);

  const filtered = templates?.filter((template) => !category || template.category === category) ?? [];

  async function use(template: TemplateResponse) {
    if (!workspace) return;
    setUsingId(template.id);
    try {
      const document = await api.useTemplate(template.id, workspace.id);
      navigate(`/documents/${document.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create from template");
    } finally {
      setUsingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Templates</h1>
          <p className="text-sm text-muted-foreground">Start from a professionally composed layout.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant={category === null ? "secondary" : "outline"} size="sm" onClick={() => setCategory(null)}>
            All
          </Button>
          {categories.map((item) => (
            <Button
              key={item}
              variant={category === item ? "secondary" : "outline"}
              size="sm"
              className="capitalize"
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      {templates === null ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<LayoutTemplate />} title="No templates" description="No templates in this category yet." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template) => (
            <TemplateCard key={template.id} template={template} loading={usingId === template.id} onUse={() => use(template)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, loading, onUse }: { template: TemplateResponse; loading: boolean; onUse: () => void }) {
  const box = pageBox(template.content.page);
  const scale = 0.32;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-56 overflow-hidden bg-canvas">
        <div
          className="pf-page absolute left-1/2 top-4 origin-top"
          style={{
            width: `${box.width}mm`,
            height: `${box.height}mm`,
            transform: `translateX(-50%) scale(${scale})`,
            background: template.content.page.background,
            ...themeCss(template.content.theme),
          }}
        >
          <div
            className="pf-doc"
            style={{
              paddingTop: `${box.margins.top}mm`,
              paddingRight: `${box.margins.right}mm`,
              paddingBottom: `${box.margins.bottom}mm`,
              paddingLeft: `${box.margins.left}mm`,
            }}
          >
            {template.content.blocks.slice(0, 14).map((block) => (
              <BlockView key={block.id} block={block} theme={template.content.theme} assetUrl={api.assetUrl} />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{template.name}</p>
          <Badge variant="outline" className="capitalize">
            {template.category}
          </Badge>
        </div>
        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{template.description}</p>
        <Button size="sm" className="mt-1 w-full" loading={loading} onClick={onUse}>
          Use template
        </Button>
      </div>
    </div>
  );
}
