import * as React from "react";
import { toast } from "sonner";
import {
  AUTH_EXPIRED_EVENT,
  api,
  getStoredWorkspaceId,
  getToken,
  setStoredWorkspaceId,
  setToken,
  type UserResponse,
  type WorkspaceResponse,
} from "@/lib/api";

interface AuthContextValue {
  user: UserResponse | null;
  workspaces: WorkspaceResponse[];
  workspace: WorkspaceResponse | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  setWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserResponse | null>(null);
  const [workspaces, setWorkspaces] = React.useState<WorkspaceResponse[]>([]);
  const [workspace, setWorkspaceState] = React.useState<WorkspaceResponse | null>(null);
  const [ready, setReady] = React.useState(false);

  const applyToken = React.useCallback(async (token: string, fallbackWorkspace?: WorkspaceResponse) => {
    setToken(token);
    const [me, list] = await Promise.all([api.me(), api.listWorkspaces()]);
    setUser(me);
    setWorkspaces(list);
    const stored = getStoredWorkspaceId();
    const preferred = list.find((w) => w.id === stored) ?? list.find((w) => w.id === fallbackWorkspace?.id) ?? list[0] ?? null;
    setWorkspaceState(preferred);
    if (preferred) setStoredWorkspaceId(preferred.id);
  }, []);

  React.useEffect(() => {
    const token = getToken();
    if (!token) {
      setReady(true);
      return;
    }
    applyToken(token)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, [applyToken]);

  React.useEffect(() => {
    const handler = () => {
      setToken(null);
      setUser(null);
      setWorkspaces([]);
      setWorkspaceState(null);
      toast.error("Your session expired. Please sign in again.");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const result = await api.login({ email, password });
      await applyToken(result.access_token, result.workspace);
    },
    [applyToken],
  );

  const register = React.useCallback(
    async (email: string, password: string, fullName: string) => {
      const result = await api.register({ email, password, full_name: fullName });
      await applyToken(result.access_token, result.workspace);
    },
    [applyToken],
  );

  const logout = React.useCallback(() => {
    setToken(null);
    setStoredWorkspaceId(null);
    setUser(null);
    setWorkspaces([]);
    setWorkspaceState(null);
  }, []);

  const setWorkspace = React.useCallback(
    (workspaceId: string) => {
      const next = workspaces.find((w) => w.id === workspaceId) ?? null;
      setWorkspaceState(next);
      setStoredWorkspaceId(next?.id ?? null);
    },
    [workspaces],
  );

  const refreshWorkspaces = React.useCallback(async () => {
    const list = await api.listWorkspaces();
    setWorkspaces(list);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, workspaces, workspace, ready, login, register, logout, setWorkspace, refreshWorkspaces }),
    [user, workspaces, workspace, ready, login, register, logout, setWorkspace, refreshWorkspaces],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function useRequireWorkspace(): WorkspaceResponse {
  const { workspace } = useAuth();
  if (!workspace) throw new Error("No workspace selected");
  return workspace;
}
