import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Cache onboarded status in localStorage so /dashboard renders with zero network on every login
// after the first one. Per-user key. Only set once profiles.onboarded_at is confirmed.
const onboardedKey = (uid: string) => `lp:onboarded:${uid}`;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const uid = session?.user.id;
  const cached = uid ? localStorage.getItem(onboardedKey(uid)) === "1" : false;
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(cached ? false : null);

  useEffect(() => {
    if (loading || !uid) return;
    if (cached) { setNeedsOnboarding(false); return; }
    if (location.pathname === "/welcome") { setNeedsOnboarding(false); return; }
    // Background check — non-blocking. Render Welcome optimistically meanwhile.
    supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarded_at) {
          localStorage.setItem(onboardedKey(uid), "1");
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(true);
        }
      });
  }, [uid, loading, cached, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Cached -> instant render. Unknown -> assume onboarded if route is /welcome else show Welcome.
  if (needsOnboarding === true) return <Navigate to="/welcome" replace />;
  if (needsOnboarding === null && location.pathname !== "/welcome") {
    // First visit ever — quickly redirect to Welcome; check resolves on next render.
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
