import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Minus, Trash2, Ban, CheckCircle2, Coins, Globe, Package, ShoppingCart, MessageSquare, KeyRound, Facebook, Briefcase, Camera, MoreHorizontal, Sparkles, Calendar, Mail } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { countryByCode } from "@/data/countries";

type AdjustMode = "add" | "remove";

type AdminUser = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  country: string | null;
  user_type: "business" | "creator" | "other" | null;
  created_at: string;
  suspended: boolean;
  onboarded_at: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_current_period_end: string | null;
  free_until: string | null;
  balance: number;
  productCount: number;
  orderCount: number;
  conversationCount: number;
  aiSpend: number;
  pages: Array<{ page_name: string | null }>;
};

const userTypeMeta = (t: AdminUser["user_type"]) => {
  if (t === "business") return { label: "Business owner", icon: Briefcase };
  if (t === "creator") return { label: "Content creator", icon: Camera };
  if (t === "other") return { label: "Other", icon: MoreHorizontal };
  return { label: "Not set", icon: MoreHorizontal };
};

const AdjustCreditsDialog = ({ userId, displayName, mode, onDone }: { userId: string; displayName: string; mode: AdjustMode; onDone: () => void }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const mutate = useMutation({
    mutationFn: async () => {
      const value = mode === "add" ? Number(amount) : -Number(amount);
      const { data, error } = await supabase.functions.invoke("admin-adjust-credits", {
        body: { user_id: userId, amount: value, note },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success(t("admin.users.creditsUpdated"));
      setAmount(""); setNote(""); setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={mode === "remove" ? "text-amber-700 border-amber-300" : ""}>
          {mode === "add" ? <Plus className="h-3.5 w-3.5 mr-1" /> : <Minus className="h-3.5 w-3.5 mr-1" />}
          {mode === "add" ? t("admin.users.addCredits") : t("admin.users.removeCredits")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? t("admin.users.addCredits") : t("admin.users.removeCredits")} — {displayName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input type="number" placeholder={t("admin.users.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input placeholder={t("admin.users.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            className="w-full"
            disabled={!amount || Number(amount) <= 0 || mutate.isPending}
            onClick={() => mutate.mutate()}
          >
            {mode === "add" ? `+ $${amount || 0}` : `− $${amount || 0}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const GrantSubscriptionDialog = ({ userId, displayName, currentUntil, onDone }: { userId: string; displayName: string; currentUntil: string | null; onDone: () => void }) => {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");

  const grant = useMutation({
    mutationFn: async () => {
      const body: any = { user_id: userId, mode: "grant", note };
      if (until) body.until = new Date(until).toISOString();
      else body.days = Number(days);
      const { data, error } = await supabase.functions.invoke("admin-grant-subscription", { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Paid access granted"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-grant-subscription", {
        body: { user_id: userId, mode: "revoke", note },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Paid access revoked"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300">
          <Sparkles className="h-3.5 w-3.5 mr-1" />Grant paid access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant paid access — {displayName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {currentUntil && (
            <p className="text-xs text-muted-foreground">
              Current access ends: <span className="font-medium text-foreground">{new Date(currentUntil).toLocaleString()}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Number of days from now</label>
            <Input type="number" min="1" placeholder="e.g. 30" value={days} onChange={(e) => { setDays(e.target.value); setUntil(""); }} />
          </div>
          <div className="text-center text-xs text-muted-foreground">— or —</div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Exact end date</label>
            <Input type="datetime-local" value={until} onChange={(e) => { setUntil(e.target.value); }} />
          </div>
          <Input placeholder="Internal note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" disabled={grant.isPending || (!until && (!days || Number(days) <= 0))} onClick={() => grant.mutate()}>
            Activate paid access
          </Button>
          <Button variant="ghost" className="w-full text-destructive" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
            Revoke paid access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StatTile = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: string }) => (
  <div className="rounded-xl border border-border bg-card/60 p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
    <p className={`font-display text-2xl font-bold ${accent ?? ""}`}>{value}</p>
  </div>
);

const UserDetailsDialog = ({
  user,
  open,
  onOpenChange,
  onAction,
}: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAction: () => void;
}) => {
  const { t } = useTranslation();
  const country = countryByCode(user.country);
  const ut = userTypeMeta(user.user_type);
  const UTIcon = ut.icon;
  const displayName = user.full_name || user.display_name || user.email || "User";

  const suspend = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-suspend-user", { body: { user_id: user.id, suspended: !user.suspended } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success(t("admin.users.updated")); onAction(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: user.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success(t("admin.users.deleted")); onAction(); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const sendReset = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-send-password-reset", { body: { user_id: user.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => toast.success("Reset email sent"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{displayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Identity */}
          <div className="flex flex-wrap items-center gap-2">
            {user.suspended && <Badge variant="destructive">Suspended</Badge>}
            {!user.onboarded_at && <Badge variant="outline">Onboarding incomplete</Badge>}
            <Badge variant="secondary" className="gap-1.5">
              <UTIcon className="h-3 w-3" />{ut.label}
            </Badge>
            {country && (
              <Badge variant="secondary" className="gap-1.5">
                <span>{country.flag}</span>{country.name}
              </Badge>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-foreground">{user.email ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
            </div>
            <div className="col-span-full text-xs font-mono text-muted-foreground truncate">{user.id}</div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatTile icon={Coins} label="Credit balance" value={`$${user.balance.toFixed(2)}`} accent="text-amber-600" />
            <StatTile icon={Sparkles} label="AI spent" value={`$${user.aiSpend.toFixed(2)}`} />
            <StatTile icon={Facebook} label="FB pages" value={user.pages.length} />
            <StatTile icon={Package} label="Products" value={user.productCount} />
            <StatTile icon={ShoppingCart} label="Orders" value={user.orderCount} />
            <StatTile icon={MessageSquare} label="Conversations" value={user.conversationCount} />
          </div>

          {/* Pages */}
          {user.pages.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Connected Facebook pages</p>
              <div className="flex flex-wrap gap-1.5">
                {user.pages.map((pg, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Facebook className="h-3 w-3" />{pg.page_name || "Unnamed"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <AdjustCreditsDialog userId={user.id} displayName={displayName} mode="add" onDone={onAction} />
            <AdjustCreditsDialog userId={user.id} displayName={displayName} mode="remove" onDone={onAction} />
            <Button size="sm" variant="outline" onClick={() => suspend.mutate()} disabled={suspend.isPending}>
              {user.suspended
                ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("admin.users.unsuspend")}</>
                : <><Ban className="h-3.5 w-3.5 mr-1" />{t("admin.users.suspend")}</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendReset.mutate()} disabled={sendReset.isPending}>
              <KeyRound className="h-3.5 w-3.5 mr-1" />Reset password
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 ml-auto">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("admin.users.deleteConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("admin.users.deleteConfirmDesc")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate()}>
                    {t("admin.users.deletePermanently")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AdminUsers = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-full", session?.user?.id, session?.access_token],
    enabled: !!session?.access_token,
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-users`, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ include_details: true }),
      });
      const result = await response.json();
      if (!response.ok || result?.error) throw new Error(result?.error || "Failed to load users");
      return (result.users ?? []) as AdminUser[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users-full"] });

  const filtered = useMemo(() => (users ?? []).filter((u) =>
    !q ||
    u.display_name?.toLowerCase().includes(q.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(q.toLowerCase()) ||
    u.email?.toLowerCase().includes(q.toLowerCase()) ||
    u.id.toLowerCase().includes(q.toLowerCase())
  ), [users, q]);

  const openUser = users?.find((u) => u.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.users.title")}</h1>
        <p className="text-slate-500 mt-1">Click any user to see their full profile and take actions.</p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder={t("admin.users.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-white" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-lg" />)}</div>
      ) : (
        <Card className="border-0 shadow-soft overflow-hidden">
          <CardContent className="p-0 divide-y divide-border">
            {filtered.map((u) => {
              const name = u.full_name || u.display_name || t("admin.users.unnamed");
              const country = countryByCode(u.country);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setOpenId(u.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${u.suspended ? "bg-destructive" : u.onboarded_at ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{name}</p>
                      {country && <span className="text-sm leading-none" title={country.name}>{country.flag}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email ?? u.id}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <Coins className="h-3.5 w-3.5" />${u.balance.toFixed(2)}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-center text-slate-500 py-12">{t("admin.users.empty")}</p>}
          </CardContent>
        </Card>
      )}

      {openUser && (
        <UserDetailsDialog
          user={openUser}
          open={!!openId}
          onOpenChange={(o) => !o && setOpenId(null)}
          onAction={refresh}
        />
      )}
    </div>
  );
};

export default AdminUsers;
