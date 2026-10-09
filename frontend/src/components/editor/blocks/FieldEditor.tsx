import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FIELD_KINDS } from "@/document/registry";
import { fieldKeyFromLabel } from "@/document/ids";
import type { FieldBlock, FieldKind } from "@/document/types";

export function FieldEditor({ block, onChange }: { block: FieldBlock; onChange: (mutator: (draft: FieldBlock) => void) => void }) {
  const { field } = block;
  const meta = FIELD_KINDS.find((item) => item.kind === field.kind);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Label</Label>
          <Input
            value={field.label}
            onChange={(event) => {
              const label = event.target.value;
              onChange((draft) => {
                const shouldSyncKey = draft.field.key === fieldKeyFromLabel(draft.field.label);
                draft.field.label = label;
                if (shouldSyncKey) draft.field.key = fieldKeyFromLabel(label);
              });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Field type</Label>
          <Select
            value={field.kind}
            onValueChange={(value) =>
              onChange((draft) => {
                draft.field.kind = value as FieldKind;
                if (["dropdown", "radio", "checkbox"].includes(value) && !draft.field.options?.length) {
                  draft.field.options = [
                    { value: "option_1", label: "Option 1" },
                    { value: "option_2", label: "Option 2" },
                  ];
                }
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_KINDS.map((item) => (
                <SelectItem key={item.kind} value={item.kind}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Key</Label>
          <Input
            value={field.key}
            onChange={(event) =>
              onChange((draft) => {
                draft.field.key = fieldKeyFromLabel(event.target.value);
              })
            }
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Placeholder</Label>
          <Input
            value={field.placeholder ?? ""}
            onChange={(event) =>
              onChange((draft) => {
                draft.field.placeholder = event.target.value;
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Default value</Label>
          <Input
            value={(field.defaultValue as string) ?? ""}
            onChange={(event) =>
              onChange((draft) => {
                draft.field.defaultValue = event.target.value;
              })
            }
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Help text</Label>
          <Textarea
            value={field.helpText ?? ""}
            rows={2}
            onChange={(event) =>
              onChange((draft) => {
                draft.field.helpText = event.target.value;
              })
            }
          />
        </div>
      </div>

      <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
        Required
        <Switch
          checked={field.required}
          onCheckedChange={(checked) =>
            onChange((draft) => {
              draft.field.required = checked;
            })
          }
        />
      </label>

      {meta?.hasOptions ? (
        <div className="space-y-2">
          <Label>Options</Label>
          {(field.options ?? []).map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={option.label}
                onChange={(event) =>
                  onChange((draft) => {
                    const previous = draft.field.options![index];
                    previous.label = event.target.value;
                    if (previous.value === fieldKeyFromLabel(option.label) || !previous.value) {
                      previous.value = fieldKeyFromLabel(event.target.value);
                    }
                  })
                }
                className="h-8"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={(field.options?.length ?? 0) <= 1}
                onClick={() =>
                  onChange((draft) => {
                    draft.field.options!.splice(index, 1);
                  })
                }
                aria-label="Remove option"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onChange((draft) => {
                const next = (draft.field.options?.length ?? 0) + 1;
                draft.field.options = [...(draft.field.options ?? []), { value: `option_${next}`, label: `Option ${next}` }];
              })
            }
          >
            <Plus className="size-3.5" /> Add option
          </Button>
        </div>
      ) : null}

      {field.kind === "number" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Minimum</Label>
            <Input
              type="number"
              value={field.validation?.min ?? ""}
              onChange={(event) =>
                onChange((draft) => {
                  draft.field.validation = { ...draft.field.validation, min: event.target.value === "" ? undefined : Number(event.target.value) };
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Maximum</Label>
            <Input
              type="number"
              value={field.validation?.max ?? ""}
              onChange={(event) =>
                onChange((draft) => {
                  draft.field.validation = { ...draft.field.validation, max: event.target.value === "" ? undefined : Number(event.target.value) };
                })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
