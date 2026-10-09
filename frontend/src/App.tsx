import * as React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageLoader } from "@/components/ui/feedback";
import { AppProviders } from "@/app/AppProviders";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { LoginPage } from "@/features/auth/LoginPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { NewDocumentPage } from "@/features/documents/NewDocumentPage";
import { TemplatesPage } from "@/features/templates/TemplatesPage";
import { FormsPage } from "@/features/forms/FormsPage";
import { FormDetailPage } from "@/features/forms/FormDetailPage";
import { PublicFormPage } from "@/features/public/PublicFormPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { EditorPage } from "@/features/editor/EditorPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";

function ProtectedLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader label="Starting Paperflow" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader label="Starting Paperflow" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader label="Starting Paperflow" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/f/:slug" element={<PublicFormPage />} />
          <Route
            path="/documents/:documentId"
            element={
              <RequireAuth>
                <EditorPage />
              </RequireAuth>
            }
          />
          <Route element={<ProtectedLayout />}>
            <Route index element={<DocumentsPage />} />
            <Route path="/documents/new" element={<NewDocumentPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/forms" element={<FormsPage />} />
            <Route path="/forms/:formId" element={<FormDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </AppProviders>
  );
}
