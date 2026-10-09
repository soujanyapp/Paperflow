import * as React from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "!rounded-lg !border-border !bg-card !text-card-foreground !shadow-lg",
        }}
      />
    </TooltipProvider>
  );
}
