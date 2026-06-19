import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Facebook, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

const AdminFbPages = () => {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-fb-pages"],
    queryFn: async () => {
      const [{ data: pages }, { data: emailRes }, { data: profiles }] = await Promise.all([
        supabase
          .from("fb_pages")
          .select("id, fb_page_id, page_name, page_picture_url, is_active, subscription_status, user_id, connected_at, last_sync_at")
          .order("created_at", { ascending: false }),
        supabase.functions.invoke("admin-list-users").then((r) => ({ data: r.data })).catch(() => ({ data: { emails: {} } })),
        supabase.from("profiles").select("id, display_name"),
      ]);
      const emails: Record<string, string> = emailRes?.emails ?? {};
      const names: Record<string, string> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name]));
      return (pages ?? []).map((p: any) => ({
        ...p,
        owner_email: emails[p.user_id] ?? null,
        owner_name: names[p.user_id] ?? null,
      }));
    },
  });
  const pages = data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.fbPages.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.fbPages.subtitle")}</p>
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(pages ?? []).map((p: any) => (
            <Card key={p.id} className="border-0 shadow-soft">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  {p.page_picture_url ? (
                    <img src={p.page_picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <Facebook className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{p.page_name || "Unnamed"}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{p.fb_page_id}</p>
                  </div>
                  <Badge variant={p.is_active ? "default" : "secondary"}>
                    {p.subscription_status || (p.is_active ? "active" : "pending")}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">Owner: <span className="font-mono">{p.user_id?.slice(0, 8)}…</span></p>
              </CardContent>
            </Card>
          ))}
          {(!pages || pages.length === 0) && (
            <Card className="border-dashed border-2 col-span-full p-10 text-center">
              <Globe className="h-10 w-10 mx-auto text-slate-400 mb-2" />
              <p className="text-slate-500">{t("admin.fbPages.empty")}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminFbPages;
