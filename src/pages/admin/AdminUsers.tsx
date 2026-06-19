import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Minus, Trash2, Ban, CheckCircle2, Coins, Globe, Package, ShoppingCart, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const AdminUsers = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"add" | "remove">("add");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-full"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, created_at, suspended")
        .order("created_at", { ascending: false });
      const enriched = await Promise.all((profiles ?? []).map(async (p) => {
        const [credits, products, orders, conversations, pages] = await Promise.all([
          supabase.from("user_credits").select("balance").eq("user_id", p.id).maybeSingle(),
          supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", p.id),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", p.id),
          supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", p.id),
          supabase.from("fb_pages").select("page_name").eq("user_id", p.id),
        ]);
        return {
          ...p,
          balance: Number(credits.data?.balance ?? 0),
          productCount: products.count ?? 0,
          orderCount: orders.count ?? 0,
          conversationCount: conversations.count ?? 0,
          pages: pages.data ?? [],
        };
      }));
      return enriched;
    },
  });

  const adjust = useMutation({
    mutationFn: async ({ userId, value }: { userId: string; value: number }) => {
      const { data, error } = await supabase.functions.invoke("admin-adjust-credits", {
        body: { user_id: userId, amount: value, note },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success(t("admin.users.creditsUpdated"));
      qc.invalidateQueries({ queryKey: ["admin-users-full"] });
      setAmount(""); setNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const suspend = useMutation({
    mutationFn: async ({ userId, suspended }: { userId: string; suspended: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin-suspend-user", { body: { user_id: userId, suspended } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success(t("admin.users.updated")); qc.invalidateQueries({ queryKey: ["admin-users-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: userId } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success(t("admin.users.deleted")); qc.invalidateQueries({ queryKey: ["admin-users-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (users ?? []).filter(u =>
    !q || u.display_name?.toLowerCase().includes(q.toLowerCase()) || u.id.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.users.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.users.subtitle")}</p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder={t("admin.users.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-white" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((u) => (
            <Card key={u.id} className="border-0 shadow-soft hover:shadow-elevated transition-all">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-lg truncate">{u.display_name || t("admin.users.unnamed")}</h3>
                      {u.suspended && <Badge variant="destructive">{t("admin.users.suspended")}</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-1 truncate">{u.id}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t("admin.users.joined")}: {new Date(u.created_at).toLocaleDateString()}</p>

                    <div className="flex gap-4 mt-3 text-xs text-slate-600 flex-wrap">
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" />{u.productCount}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{u.orderCount}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{u.conversationCount}</span>
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{u.pages.length}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-slate-500 tracking-wide">{t("admin.users.balance")}</p>
                      <p className="font-display text-2xl font-bold text-amber-600 flex items-center gap-1">
                        <Coins className="h-5 w-5" /> ৳{u.balance.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Dialog>
                      <Button asChild size="sm" variant="outline">
                        <span onClick={() => setMode("add")}><Plus className="h-3.5 w-3.5 mr-1" />{t("admin.users.addCredits")}</span>
                      </Button>
                    </Dialog>
                    <Dialog>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{mode === "add" ? t("admin.users.addCredits") : t("admin.users.removeCredits")}</DialogTitle></DialogHeader>
                        <div className="space-y-3 pt-2">
                          <Input type="number" placeholder={t("admin.users.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
                          <Input placeholder={t("admin.users.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
                          <DialogClose asChild>
                            <Button className="w-full" disabled={!amount || Number(amount) <= 0}
                              onClick={() => adjust.mutate({ userId: u.id, value: mode === "add" ? Number(amount) : -Number(amount) })}>
                              {mode === "add" ? `+ ৳${amount || 0}` : `- ৳${amount || 0}`}
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <CreditDialog
                      mode="add"
                      onSubmit={(v, n) => adjust.mutate({ userId: u.id, value: v })}
                      amount={amount} setAmount={setAmount} note={note} setNote={setNote}
                    />
                    <CreditDialog
                      mode="remove"
                      onSubmit={(v, n) => adjust.mutate({ userId: u.id, value: -v })}
                      amount={amount} setAmount={setAmount} note={note} setNote={setNote}
                    />

                    <Button size="sm" variant="outline" onClick={() => suspend.mutate({ userId: u.id, suspended: !u.suspended })}>
                      {u.suspended ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("admin.users.unsuspend")}</> : <><Ban className="h-3.5 w-3.5 mr-1" />{t("admin.users.suspend")}</>}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("admin.users.deleteConfirmTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("admin.users.deleteConfirmDesc")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(u.id)}>
                            {t("admin.users.deletePermanently")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-slate-500 py-12">{t("admin.users.empty")}</p>}
        </div>
      )}
    </div>
  );
};

// Simple credit dialog component
const CreditDialog = ({ mode, onSubmit, amount, setAmount, note, setNote }: any) => {
  const { t } = useTranslation();
  return (
    <Dialog>
      <Button asChild size="sm" variant="outline" className={mode === "remove" ? "text-amber-700" : ""}>
        <span>{mode === "add" ? <><Plus className="h-3.5 w-3.5 mr-1" />{t("admin.users.addCredits")}</> : <><Minus className="h-3.5 w-3.5 mr-1" />{t("admin.users.removeCredits")}</>}</span>
      </Button>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "add" ? t("admin.users.addCredits") : t("admin.users.removeCredits")}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input type="number" placeholder={t("admin.users.amount")} value={amount} onChange={(e: any) => setAmount(e.target.value)} />
          <Input placeholder={t("admin.users.notePlaceholder")} value={note} onChange={(e: any) => setNote(e.target.value)} />
          <DialogClose asChild>
            <Button className="w-full" disabled={!amount || Number(amount) <= 0} onClick={() => onSubmit(Number(amount), note)}>
              {t("common.confirm")}
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUsers;
