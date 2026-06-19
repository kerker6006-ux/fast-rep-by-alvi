import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type BusinessCategory = "ecommerce" | "dental" | "hvac" | "salon";

export const BUSINESS_CATEGORIES: BusinessCategory[] = ["ecommerce", "dental", "hvac", "salon"];

export function useBusinessCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["profile-category", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("business_category, business_info")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const setCategory = useMutation({
    mutationFn: async (category: BusinessCategory) => {
      const { error } = await supabase
        .from("profiles")
        .update({ business_category: category })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile-category"] }),
  });

  const setBusinessInfo = useMutation({
    mutationFn: async (info: Record<string, any>) => {
      const { error } = await supabase
        .from("profiles")
        .update({ business_info: info as any })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile-category"] }),
  });

  return {
    category: query.data?.business_category as BusinessCategory | null | undefined,
    businessInfo: (query.data?.business_info as Record<string, any>) || {},
    isLoading: query.isLoading,
    setCategory,
    setBusinessInfo,
  };
}
