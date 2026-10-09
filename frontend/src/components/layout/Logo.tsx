import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
        <FileText className="size-4" />
      </span>
      {showText ? <span className="text-sm font-semibold tracking-tight">Paperflow</span> : null}
    </span>
  );
}
