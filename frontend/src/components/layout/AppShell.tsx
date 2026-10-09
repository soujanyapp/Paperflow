import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutTemplate, LogOut, Settings, SquarePen, Table2, Files } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";

const NAV = [
  { to: "/", label: "Documents", icon: Files, end: true },
  { to: "/templates", label: "Templates", icon: LayoutTemplate, end: false },
  { to: "/forms", label: "Forms", icon: Table2, end: false },
];

export function AppShell() {
  const { user, workspaces, workspace, setWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <button onClick={() => navigate("/")} className="mr-1" aria-label="Paperflow home">
            <Logo />
          </button>

          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[220px] justify-between">
                  <span className="truncate">{workspace?.name ?? "Workspace"}</span>
                  {workspace?.is_personal ? <Badge variant="neutral">Personal</Badge> : null}
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                {workspaces.map((item) => (
                  <DropdownMenuItem key={item.id} onSelect={() => setWorkspace(item.id)}>
                    <span className="truncate">{item.name}</span>
                    {item.id === workspace?.id ? <span className="ml-auto text-primary">•</span> : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/settings")}>
                  <Settings className="size-4" /> Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={() => navigate("/documents/new")} className="gap-1.5">
              <SquarePen className="size-3.5" />
              <span className="hidden sm:inline">New document</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
                  aria-label="Account menu"
                >
                  {(user?.full_name || user?.email || "?").slice(0, 1).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="normal-case">
                  <span className="block truncate text-sm text-foreground">{user?.full_name || "Account"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/settings")}>
                  <Settings className="size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  destructive
                  onSelect={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
