import type { Session } from "@supabase/supabase-js";

export const checkAdminRole = async (session: Session | null | undefined) => {
  if (!session?.user?.id || !session.access_token) return false;

  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_roles`);
  url.searchParams.set("select", "role");
  url.searchParams.set("user_id", `eq.${session.user.id}`);
  url.searchParams.set("role", "eq.admin");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to verify administrator access.");
  }

  const rows = (await response.json()) as Array<{ role: string }>;
  return rows.some((row) => row.role === "admin");
};