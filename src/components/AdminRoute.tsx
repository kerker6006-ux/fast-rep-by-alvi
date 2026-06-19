import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading } = useIsAdmin();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

export default AdminRoute;
