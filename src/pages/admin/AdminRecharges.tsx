import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const AdminRecharges = () => {
  const { t } = useTranslation();
  const { data: txns, isLoading } = useQuery({
    queryKey: ["admin-recent-recharges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, user_id, amount, type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.recharges.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.recharges.subtitle")}</p>
      </header>

      {isLoading ? (
        <div className="h-40 bg-slate-100 animate-pulse rounded-xl" />
      ) : (
        <Card className="border-0 shadow-soft">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">{t("admin.recharges.date")}</th>
                  <th className="px-4 py-3 text-left">{t("admin.recharges.user")}</th>
                  <th className="px-4 py-3 text-left">{t("admin.recharges.type")}</th>
                  <th className="px-4 py-3 text-right">{t("admin.recharges.amount")}</th>
                  <th className="px-4 py-3 text-left">{t("admin.recharges.note")}</th>
                </tr>
              </thead>
              <tbody>
                {(txns ?? []).map((tx: any) => (
                  <tr key={tx.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[160px]">{tx.user_id}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{tx.type}</Badge></td>
                    <td className={`px-4 py-3 text-right font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.amount >= 0 ? "+" : ""}৳{Number(tx.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{tx.description || "—"}</td>
                  </tr>
                ))}
                {(!txns || txns.length === 0) && (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-500">{t("admin.recharges.empty")}</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminRecharges;
