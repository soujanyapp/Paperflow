import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Palette } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { THEMES, FONT_OPTIONS } from "@/document/constants";
import { labelForBlock } from "@/document/registry";
import { cn } from "@/lib/utils";
import { useEditorStore, useSelectedBlock } from "@/store/editorStore";
import type { MarginKey } from "@/document/types";

export function Inspector() {
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="block" className="flex h-full flex-col">
        <div className="border-b border-border px-3 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="block" className="flex-1">
              Block
            </TabsTrigger>
            <TabsTrigger value="page" className="flex-1">
              Page
            </TabsTrigger>
            <TabsTrigger value="document" className="flex-1">
              Document
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="block" className="mt-0">
            <BlockInspector />
          </TabsContent>
          <TabsContent value="page" className="mt-0">
            <PageInspector />
          </TabsContent>
          <TabsContent value="document" className="mt-0">
            <DocumentInspector />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberInput({ value, onChange, step = 1, suffix }: { value: number; onChange: (value: number) => void; step?: number; suffix?: string }) {
  return (
    <div className="relative">
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8"
      />
      {suffix ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

function ColorInput({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
      />
      <Input value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="h-8 font-mono text-xs" />
    </div>
  );
}

const ALIGNMENTS = [
  { value: "left", icon: <AlignLeft className="size-3.5" /> },
  { value: "center", icon: <AlignCenter className="size-3.5" /> },
  { value: "right", icon: <AlignRight className="size-3.5" /> },
  { value: "justify", icon: <AlignJustify className="size-3.5" /> },
] as const;

function BlockInspector() {
  const block = useSelectedBlock();
  const updateSelected = useEditorStore((state) => state.updateSelected);

  if (!block) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Select a block to style it. Double-click to edit its content.
      </div>
    );
  }

  const style = block.style ?? {};

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm font-medium">{labelForBlock(block)}</div>

      <Field label="Alignment">
        <div className="flex gap-1">
          {ALIGNMENTS.map((item) => (
            <Button
              key={item.value}
              variant={style.textAlign === item.value ? "secondary" : "outline"}
              size="icon-sm"
              onClick={() => updateSelected((draft) => void (draft.style = { ...draft.style, textAlign: item.value }))}
            >
              {item.icon}
            </Button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Font size">
          <NumberInput
            value={style.fontSize ?? 0}
            suffix="pt"
            onChange={(value) => updateSelected((draft) => void (draft.style = { ...draft.style, fontSize: value || undefined }))}
          />
        </Field>
        <Field label="Weight">
          <Select
            value={String(style.fontWeight ?? "400")}
            onValueChange={(value) => updateSelected((draft) => void (draft.style = { ...draft.style, fontWeight: Number(value) }))}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[300, 400, 500, 600, 700, 800].map((weight) => (
                <SelectItem key={weight} value={String(weight)}>
                  {weight}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Text colour">
        <ColorInput value={style.color} onChange={(value) => updateSelected((draft) => void (draft.style = { ...draft.style, color: value }))} />
      </Field>
      <Field label="Background">
        <ColorInput
          value={style.backgroundColor}
          onChange={(value) => updateSelected((draft) => void (draft.style = { ...draft.style, backgroundColor: value || undefined }))}
        />
      </Field>

      <Field label={`Width — ${style.width ?? 100}%`}>
        <Slider
          value={[style.width ?? 100]}
          min={10}
          max={100}
          step={1}
          onValueChange={([value]) => updateSelected((draft) => void (draft.style = { ...draft.style, width: value }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Margin top">
          <NumberInput value={style.marginTop ?? 0} suffix="mm" onChange={(value) => updateSelected((draft) => void (draft.style = { ...draft.style, marginTop: value }))} />
        </Field>
        <Field label="Margin bottom">
          <NumberInput value={style.marginBottom ?? 0} suffix="mm" onChange={(value) => updateSelected((draft) => void (draft.style = { ...draft.style, marginBottom: value }))} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
        Keep with next
        <Switch
          checked={Boolean(style.keepWithNext)}
          onCheckedChange={(checked) => updateSelected((draft) => void (draft.style = { ...draft.style, keepWithNext: checked }))}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
        Hidden
        <Switch
          checked={Boolean(block.hidden)}
          onCheckedChange={(checked) => updateSelected((draft) => void (draft.hidden = checked))}
        />
      </div>
    </div>
  );
}

const MARGIN_KEYS: MarginKey[] = ["top", "right", "bottom", "left"];

function PageInspector() {
  const page = useEditorStore((state) => state.document.page);
  const pageNumber = useEditorStore((state) => state.document.pageNumber);
  const header = useEditorStore((state) => state.document.header);
  const footer = useEditorStore((state) => state.document.footer);
  const edit = useEditorStore((state) => state.edit);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paper size">
          <Select
            value={page.size}
            onValueChange={(value) => edit((doc) => void (doc.page.size = value as typeof page.size))}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4 (210 × 297mm)</SelectItem>
              <SelectItem value="Letter">Letter (8.5 × 11in)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Orientation">
          <Select
            value={page.orientation}
            onValueChange={(value) => edit((doc) => void (doc.page.orientation = value as typeof page.orientation))}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Margins">
        <div className="grid grid-cols-4 gap-2">
          {MARGIN_KEYS.map((key) => (
            <div key={key} className="space-y-1">
              <span className="block text-center text-[10px] uppercase text-muted-foreground">{key}</span>
              <NumberInput
                value={page.margins[key]}
                suffix="mm"
                onChange={(value) =>
                  edit((doc) => {
                    doc.page.margins[key] = Math.max(0, value);
                  })
                }
              />
            </div>
          ))}
        </div>
      </Field>

      <Field label="Page background">
        <ColorInput value={page.background} onChange={(value) => edit((doc) => void (doc.page.background = value))} />
      </Field>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Baseline className="size-3.5 text-muted-foreground" /> Page numbers
          </span>
          <Switch checked={pageNumber.enabled} onCheckedChange={(checked) => edit((doc) => void (doc.pageNumber.enabled = checked))} />
        </div>
        {pageNumber.enabled ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Format">
                <Select value={pageNumber.format} onValueChange={(value) => edit((doc) => void (doc.pageNumber.format = value as typeof pageNumber.format))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="n">1</SelectItem>
                    <SelectItem value="n-of-total">1 / 4</SelectItem>
                    <SelectItem value="page-n">Page 1</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Start at">
                <NumberInput value={pageNumber.startAt} onChange={(value) => edit((doc) => void (doc.pageNumber.startAt = Math.max(1, value)))} />
              </Field>
            </div>
            <div className="flex items-center justify-between text-sm">
              Hide on first page
              <Switch checked={pageNumber.hideOnFirst} onCheckedChange={(checked) => edit((doc) => void (doc.pageNumber.hideOnFirst = checked))} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between text-sm">
          <span>Header ({header.blocks.length} blocks)</span>
          <Switch checked={header.enabled} onCheckedChange={(checked) => edit((doc) => void (doc.header.enabled = checked))} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Footer ({footer.blocks.length} blocks)</span>
          <Switch checked={footer.enabled} onCheckedChange={(checked) => edit((doc) => void (doc.footer.enabled = checked))} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Header and footer regions render on every exported page. Use the document template to predefine them.
        </p>
      </div>
    </div>
  );
}

function DocumentInspector() {
  const theme = useEditorStore((state) => state.document.theme);
  const title = useEditorStore((state) => state.document.title);
  const setTitle = useEditorStore((state) => state.setTitle);
  const setTheme = useEditorStore((state) => state.setTheme);
  const edit = useEditorStore((state) => state.edit);

  return (
    <div className="space-y-5">
      <Field label="Title">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>

      <Field label="Theme">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setTheme(preset)}
              className={cn(
                "rounded-lg border p-2 text-left text-xs transition-colors",
                theme.id === preset.id ? "border-primary bg-accent/50" : "border-border hover:border-primary/40",
              )}
            >
              <span className="mb-1 flex items-center gap-1.5 font-medium">
                <span className="size-3 rounded-full" style={{ background: preset.accentColor }} />
                {preset.name}
              </span>
              <span className="block truncate text-muted-foreground" style={{ fontFamily: preset.bodyFont }}>
                {preset.bodyFont}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Heading font">
          <Select value={theme.headingFont} onValueChange={(value) => edit((doc) => void (doc.theme.headingFont = value))}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Body font">
          <Select value={theme.bodyFont} onValueChange={(value) => edit((doc) => void (doc.theme.bodyFont = value))}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={`Base font size — ${theme.baseFontSize}pt`}>
        <Slider
          value={[theme.baseFontSize]}
          min={8}
          max={16}
          step={0.5}
          onValueChange={([value]) => edit((doc) => void (doc.theme.baseFontSize = value))}
        />
      </Field>
      <Field label={`Line height — ${theme.lineHeight}`}>
        <Slider
          value={[theme.lineHeight]}
          min={1}
          max={2.2}
          step={0.05}
          onValueChange={([value]) => edit((doc) => void (doc.theme.lineHeight = value))}
        />
      </Field>

      <Field label="Accent colour">
        <ColorInput value={theme.accentColor} onChange={(value) => edit((doc) => void (doc.theme.accentColor = value))} />
      </Field>
      <Field label="Text colour">
        <ColorInput value={theme.textColor} onChange={(value) => edit((doc) => void (doc.theme.textColor = value))} />
      </Field>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Palette className="size-3" /> Themes apply to the document canvas and exported PDF.
      </p>
    </div>
  );
}
