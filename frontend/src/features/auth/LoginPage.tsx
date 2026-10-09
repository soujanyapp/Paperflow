import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError } from "@/lib/api";

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, fullName);
      toast.success(mode === "login" ? "Welcome back" : "Workspace created");
      navigate(from, { replace: true });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.code === "invalid_credentials"
            ? "Incorrect email or password."
            : error.message
          : "Something went wrong.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <Logo className="text-background [&_span:last-child]:text-background" />
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="font-serif text-4xl leading-tight">
            Documents that look like they were <span className="text-[var(--primary)]">printed</span>, built in the browser.
          </h1>
          <p className="text-sm text-background/70">
            Compose reports, letters, certificates and forms on a true-to-print canvas. Publish a shareable form, collect
            responses, and export pixel-faithful PDFs.
          </p>
          <ul className="space-y-3 text-sm text-background/80">
            <li className="flex items-center gap-3">
              <Sparkles className="size-4 text-[var(--primary)]" /> Live A4 canvas with pagination
            </li>
            <li className="flex items-center gap-3">
              <Layers className="size-4 text-[var(--primary)]" /> Rich blocks, tables and repeaters
            </li>
            <li className="flex items-center gap-3">
              <FileText className="size-4 text-[var(--primary)]" /> Playwright-rendered PDF export
            </li>
          </ul>
        </div>
        <p className="relative z-10 text-xs text-background/40">Secure, self-hosted, and yours to keep.</p>
        <div className="pointer-events-none absolute -right-24 top-1/4 size-96 rounded-full bg-[var(--primary)]/25 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">
              {mode === "login" ? "Sign in to Paperflow" : "Create your workspace"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Continue where you left off." : "It takes a few seconds to get started."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" ? (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              {mode === "login" ? "Sign in" : "Create workspace"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "New to Paperflow?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
