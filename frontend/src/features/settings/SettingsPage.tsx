import * as React from "react";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";

export function SettingsPage() {
  const { user, workspace, workspaces, setWorkspace, refreshWorkspaces } = useAuth();
  const [newWorkspace, setNewWorkspace] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [members, setMembers] = React.useState<Array<Record<string, unknown>>>([]);

  React.useEffect(() => {
    if (!workspace) return;
    api
      .listMembers(workspace.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [workspace]);

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    if (!newWorkspace.trim()) return;
    setCreating(true);
    try {
      const created = await api.createWorkspace(newWorkspace.trim());
      await refreshWorkspaces();
      setWorkspace(created.id);
      setNewWorkspace("");
      toast.success("Workspace created");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create workspace");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and workspaces.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input readOnly value={user?.full_name || "—"} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input readOnly value={user?.email ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Member since</Label>
            <Input readOnly value={formatDate(user?.created_at)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <CardDescription>Documents and forms are scoped to a workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {workspaces.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.is_personal ? <Badge variant="neutral">Personal</Badge> : null}
                  {item.id === workspace?.id ? <Badge variant="success">Current</Badge> : null}
                </div>
                {item.id !== workspace?.id ? (
                  <Button variant="outline" size="sm" onClick={() => setWorkspace(item.id)}>
                    Switch
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <form onSubmit={createWorkspace} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>New workspace</Label>
              <Input value={newWorkspace} onChange={(event) => setNewWorkspace(event.target.value)} placeholder="Team name" />
            </div>
            <Button type="submit" loading={creating} className="gap-1.5">
              <Plus className="size-3.5" /> Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> Members
          </CardTitle>
          <CardDescription>People with access to {workspace?.name}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            members.map((member) => (
              <div key={String(member.id)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>{String(member.full_name || member.email || "Member")}</span>
                <Badge variant="outline" className="capitalize">
                  {String(member.role)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
