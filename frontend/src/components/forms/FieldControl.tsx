import type { FieldDefinition } from "@/document/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FieldControlProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string | null;
}

export function FieldControl({ field, value, onChange, disabled, error }: FieldControlProps) {
  const describedBy = error ? `${field.key}-error` : field.helpText ? `${field.key}-help` : undefined;

  return (
    <div className="space-y-1.5" data-field-key={field.key}>
      <Label htmlFor={field.key} className="normal-case text-foreground">
        {field.label}
        {field.required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {renderControl(field, value, onChange, disabled, describedBy)}
      {error ? (
        <p id={`${field.key}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : field.helpText ? (
        <p id={`${field.key}-help`} className="text-xs text-muted-foreground">
          {field.helpText}
        </p>
      ) : null}
    </div>
  );
}

function renderControl(
  field: FieldDefinition,
  value: unknown,
  onChange: (value: unknown) => void,
  disabled: boolean | undefined,
  describedBy: string | undefined,
) {
  const common = {
    id: field.key,
    disabled,
    "aria-describedby": describedBy,
    placeholder: field.placeholder,
    required: field.required,
  };

  switch (field.kind) {
    case "longText":
    case "richText":
      return (
        <Textarea
          {...common}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      );
    case "number":
      return (
        <Input
          {...common}
          type="number"
          min={field.validation?.min}
          max={field.validation?.max}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        />
      );
    case "date":
      return <Input {...common} type="date" value={(value as string) ?? ""} onChange={(event) => onChange(event.target.value)} />;
    case "email":
      return <Input {...common} type="email" value={(value as string) ?? ""} onChange={(event) => onChange(event.target.value)} />;
    case "phone":
      return (
        <Input {...common} type="tel" value={(value as string) ?? ""} onChange={(event) => onChange(event.target.value)} />
      );
    case "dropdown":
      return (
        <Select value={(value as string) ?? ""} onValueChange={(next) => onChange(next)} disabled={disabled}>
          <SelectTrigger id={field.key} aria-describedby={describedBy}>
            <SelectValue placeholder={field.placeholder ?? "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup value={(value as string) ?? ""} onValueChange={onChange} disabled={disabled}>
          {(field.options ?? []).map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem value={option.value} id={`${field.key}-${option.value}`} />
              <label htmlFor={`${field.key}-${option.value}`} className="text-sm">
                {option.label}
              </label>
            </div>
          ))}
        </RadioGroup>
      );
    case "checkbox": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="grid gap-2">
          {(field.options ?? []).map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(next) => {
                    const set = new Set(selected);
                    if (next) set.add(option.value);
                    else set.delete(option.value);
                    onChange([...set]);
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      );
    }
    case "file":
      return (
        <Input
          {...common}
          type="file"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            onChange(file ? file.name : "");
          }}
          className={cn("file:mr-3 file:rounded file:bg-secondary file:px-2 file:py-0.5 file:text-secondary-foreground")}
        />
      );
    case "signature":
      return (
        <Input
          {...common}
          placeholder={field.placeholder ?? "Type your full name"}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className="font-serif italic"
        />
      );
    case "shortText":
    default:
      return <Input {...common} value={(value as string) ?? ""} onChange={(event) => onChange(event.target.value)} />;
  }
}
