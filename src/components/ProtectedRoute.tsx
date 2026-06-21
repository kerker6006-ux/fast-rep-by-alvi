import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Cache onboarded status in localStorage so /dashboard renders with zero network on every login
// after the first one. Per-user key. Set once profiles.onboarded_at is confirmed (either via
// background check here, or directly when the Welcome form submits).
const onboardedKey = (uid: string) => `lp:onboarded:${uid}`;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const uid = session?.user.id;
  const cached = uid ? localStorage.getItem(onboardedKey(uid)) === "1" : false;
  // null = unknown, true = confirmed not onboarded, false = onboarded
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(cached ? false : null);

  useEffect(() => {
    if (loading || !uid) return;
    if (localStorage.getItem(onboardedKey(uid)) === "1") {
      setNeedsOnboarding(false);
      return;
    }
    // Authoritative check — only redirects to /welcome if DB confirms no onboarded_at.
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
  }, [uid, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Only redirect to /welcome when we are CERTAIN the user is not onboarded.
  // While unknown, render the requested page optimistically — the background check will
  // redirect on its own if needed, so already-onboarded users never see the Welcome flash again.
  if (needsOnboarding === true && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
