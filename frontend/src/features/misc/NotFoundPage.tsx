import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <Logo />
      <p className="font-serif text-5xl">404</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn't find that page. It may have been moved or deleted.
      </p>
      <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
        Back to documents
      </Link>
    </div>
  );
}
