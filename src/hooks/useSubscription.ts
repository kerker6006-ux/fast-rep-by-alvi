import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useSubscription = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["sub-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { subscription_status: string | null } | null;
    },
  });
  return { hasActiveSub: data?.subscription_status === "active" };
};

const NOTICE_KEY = "lp_free_image_notice_seen";

/**
 * Show a one-time notice explaining that images uploaded by the merchant
 * are sent to customers fine, but customer-sent images can't be read by
 * the bot on the Free plan. Dismissible; appears only once per browser.
 */
export const showFreeImageNoticeOnce = (hasActiveSub: boolean) => {
  if (hasActiveSub) return;
  if (typeof window === "undefined") return;
  if (localStorage.getItem(NOTICE_KEY) === "1") return;
  localStorage.setItem(NOTICE_KEY, "1");

  toast.message("Heads up about images on the Free plan", {
    description:
      "Your bot CAN send this image to customers on Messenger just fine. But on the Free plan, the bot CANNOT look at or understand images that customers send in chat. Upgrade to unlock image understanding.",
    duration: 15000,
    action: {
      label: "Subscribe",
      onClick: () => {
        window.location.hash = "#credits";
      },
    },
  });
};
