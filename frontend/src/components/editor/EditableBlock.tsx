import * as React from "react";
import { ImagePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { RichText } from "@/components/document/RichText";
import { ListEditor } from "@/components/editor/blocks/ListEditor";
import { TableEditor } from "@/components/editor/blocks/TableEditor";
import { FieldEditor } from "@/components/editor/blocks/FieldEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fontStack } from "@/document/styles";
import { createBlock } from "@/document/factory";
import { useEditorStore } from "@/store/editorStore";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { Block, FieldBlock, ImageBlock, ListBlock, SectionBlock, SignatureBlock, SpacerBlock, TableBlock } from "@/document/types";

export interface EditableBlockProps {
  block: Block;
  renderSlot: (child: Block) => React.ReactNode;
}

export function EditableBlock({ block, renderSlot }: EditableBlockProps) {
  const theme = useEditorStore((state) => state.document.theme);
  const update = useEditorStore((state) => state.updateBlockById);
  const insertBlock = useEditorStore((state) => state.insertBlock);
  const { workspace } = useAuth();

  const mutate = (mutator: (draft: Block) => void, group: string) =>
    update(block.id, mutator, { group: `${block.id}:${group}`, history: false });

  switch (block.type) {
    case "heading":
      return (
        <div style={{ fontFamily: fontStack(theme.headingFont), fontWeight: 600, fontSize: `${1.9 - (block.level - 1) * 0.28}em`, lineHeight: 1.2 }}>
          <RichText
            value={block.text}
            autoFocus
            placeholder="Heading"
            onChange={(html) =>
              mutate((draft) => {
                (draft as { text: string }).text = html;
              }, "text")
            }
          />
        </div>
      );
    case "paragraph":
      return (
        <RichText
          value={block.html}
          autoFocus
          placeholder="Start writing…"
          onChange={(html) =>
            mutate((draft) => {
              (draft as { html: string }).html = html;
            }, "text")
          }
        />
      );
    case "bulletedList":
    case "numberedList":
      return (
        <ListEditor
          block={block as ListBlock}
          onChange={(mutator) =>
            mutate((draft) => mutator(draft as ListBlock), "list")
          }
        />
      );
    case "table":
      return (
        <TableEditor
          block={block as TableBlock}
          onChange={(mutator) => mutate((draft) => mutator(draft as TableBlock), "table")}
        />
      );
    case "image":
      return <ImageEditor block={block as ImageBlock} workspaceId={workspace?.id ?? null} onChange={(mutator) => mutate((draft) => mutator(draft as ImageBlock), "image")} />;
    case "spacer":
      return (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Label>Height</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[(block as SpacerBlock).height]}
              min={2}
              max={80}
              step={1}
              onValueChange={([value]) =>
                mutate((draft) => {
                  (draft as SpacerBlock).height = value;
                }, "spacer")
              }
            />
            <span className="w-12 text-right text-xs text-muted-foreground">{(block as SpacerBlock).height} mm</span>
          </div>
        </div>
      );
    case "signature": {
      const signature = block as SignatureBlock;
      return (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-dashed border-border p-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Label</Label>
            <Input
              value={signature.label}
              onChange={(event) =>
                mutate((draft) => {
                  (draft as SignatureBlock).label = event.target.value;
                }, "signature")
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select
              value={signature.mode}
              onValueChange={(value) =>
                mutate((draft) => {
                  (draft as SignatureBlock).mode = value as SignatureBlock["mode"];
                }, "signature")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank line</SelectItem>
                <SelectItem value="field">Linked field</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Field key</Label>
            <Input
              value={signature.fieldKey ?? ""}
              disabled={signature.mode !== "field"}
              onChange={(event) =>
                mutate((draft) => {
                  (draft as SignatureBlock).fieldKey = event.target.value;
                }, "signature")
              }
            />
          </div>
        </div>
      );
    }
    case "field":
      return (
        <FieldEditor
          block={block as FieldBlock}
          onChange={(mutator) => mutate((draft) => mutator(draft as FieldBlock), "field")}
        />
      );
    case "section":
    case "repeater": {
      const container = block as SectionBlock;
      return (
        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={container.title}
              onChange={(event) =>
                mutate((draft) => {
                  (draft as SectionBlock).title = event.target.value;
                }, "title")
              }
            />
          </div>
          <div className="space-y-4">{container.blocks.map((child) => renderSlot(child))}</div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const child = createBlock("paragraph");
              insertBlock(child, { parentId: container.id });
            }}
          >
            <Plus className="size-3.5" /> Add child block
          </Button>
        </div>
      );
    }
    default:
      return null;
  }
}

function ImageEditor({
  block,
  workspaceId,
  onChange,
}: {
  block: ImageBlock;
  workspaceId: string | null;
  onChange: (mutator: (draft: ImageBlock) => void) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    if (!workspaceId) return;
    setUploading(true);
    try {
      const asset = await api.uploadAsset(workspaceId, file);
      onChange((draft) => {
        draft.assetId = asset.id;
        draft.src = api.assetUrl(asset.id);
        draft.alt = draft.alt || asset.filename;
      });
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" loading={uploading} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-3.5" /> Upload image
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Input
          placeholder="…or paste an image URL"
          value={block.src ?? ""}
          onChange={(event) =>
            onChange((draft) => {
              draft.src = event.target.value;
            })
          }
          className="h-8 flex-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Alt text</Label>
          <Input
            value={block.alt}
            onChange={(event) =>
              onChange((draft) => {
                draft.alt = event.target.value;
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Caption</Label>
          <Input
            value={block.caption ?? ""}
            onChange={(event) =>
              onChange((draft) => {
                draft.caption = event.target.value;
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
