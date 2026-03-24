import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, user, loading, signOut } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-approval", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (profile && !profile.is_approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldX className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Account Pending Approval</h2>
            <p className="text-muted-foreground text-sm">
              আপনার অ্যাকাউন্ট এখনও অ্যাডমিন দ্বারা অনুমোদিত হয়নি। অনুগ্রহ করে অপেক্ষা করুন।
            </p>
            <p className="text-muted-foreground text-sm">
              Your account has not been approved by an admin yet. Please wait for approval.
            </p>
            <Button variant="outline" onClick={signOut} className="mt-4">
              Sign Out / লগ আউট
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
