import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useSubscriptionStatus = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["subscription-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status, free_until")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { subscription_status: string | null; free_until: string | null } | null;
    },
  });

  const freeUntil = data?.free_until ? new Date(data.free_until) : null;
  const inTrial = !!freeUntil && freeUntil.getTime() > Date.now();
  const hasActiveSub = data?.subscription_status === "active";
  const isLocked = !inTrial && !hasActiveSub;

  return { inTrial, hasActiveSub, isLocked, isLoading };
};
