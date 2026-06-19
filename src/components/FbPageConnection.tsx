import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Globe, Plus, Trash2, Copy, Check, RefreshCw, Loader2, Facebook, ChevronRight, Activity, Instagram, AlertTriangle, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";

type FbPage = {
  id: string;
  fb_page_id: string;
  page_name: string | null;
  page_picture_url?: string | null;
  is_active: boolean;
  connected_at?: string | null;
  last_sync_at?: string | null;
  subscription_status?: string | null;
  subscription_error?: string | null;
  verify_token?: string | null;
  ig_business_account_id?: string | null;
  ig_username?: string | null;
  ig_subscription_status?: string | null;
};

type SessionPage = { id: string; name: string; category: string | null; picture_url: string | null; ig_username?: string | null };

const FB_BLUE = "#1877F2";

const FbPageConnection = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ pageId: "", pageName: "", accessToken: "" });
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);

  // Detect oauth return
  useEffect(() => {
    const url = new URL(window.location.href);
    const sess = url.searchParams.get("fb_session");
    const err = url.searchParams.get("fb_error");
    if (err) {
      toast.error(`Facebook error: ${err.replace(/_/g, " ")}`);
      url.searchParams.delete("fb_error");
      window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
    }
    if (sess) {
      setSessionToken(sess);
      setPickerOpen(true);
      url.searchParams.delete("fb_session");
      window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
    }
  }, []);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["fb-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fb_pages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as FbPage[];
    },
  });

  const { data: sessionPages, isLoading: loadingSession } = useQuery({
    queryKey: ["fb-session-pages", sessionToken],
    enabled: !!sessionToken && pickerOpen,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fb-list-pages", { body: { session_token: sessionToken } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return (data?.pages ?? []) as SessionPage[];
    },
  });

  const startOAuth = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("fb-oauth-start");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      window.location.href = data.url;
    },
    onError: (e: any) => toast.error(e.message || "Could not start Facebook login"),
  });

  const connectPage = useMutation({
    mutationFn: async (pageId: string) => {
      const { data, error } = await supabase.functions.invoke("fb-connect-page", {
        body: { session_token: sessionToken, page_id: pageId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["fb-pages"] });
      setPickerOpen(false);
      setSessionToken(null);
      setSelectedPage(null);
      if (data.status === "active") toast.success("Facebook Page Connected Successfully");
      else toast.warning(`Connected, but webhook subscription failed: ${data.error ?? ""}`);
    },
    onError: (e: any) => toast.error(e.message || "Could not connect page"),
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("fb-disconnect-page", { body: { id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fb-pages"] });
      toast.success("Page disconnected");
      setDisconnectId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("fb-sync-page", { body: { id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fb-pages"] });
      toast.success("Synced");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testConn = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("fb-test-connection", { body: { id } });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.ok) toast.success(t("fb.testOk") + (data.page?.name ? ` (${data.page.name})` : ""));
      else toast.error(`${t("fb.testFail")}: ${data?.error ?? "unknown"}`);
    },
    onError: (e: any) => toast.error(`${t("fb.testFail")}: ${e.message}`),
  });

  const addManual = useMutation({
    mutationFn: async () => {
      if (!form.pageId || !form.accessToken) throw new Error("Page ID and Access Token are required");
      const { error } = await supabase.from("fb_pages").insert({
        fb_page_id: form.pageId,
        page_name: form.pageName || null,
        page_access_token: form.accessToken,
        user_id: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fb-pages"] });
      setForm({ pageId: "", pageName: "", accessToken: "" });
      setShowManual(false);
      toast.success("Page added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const webhookUrl = `${supabaseUrl}/functions/v1/fb-webhook`;
  const oauthRedirectUri = `${supabaseUrl}/functions/v1/fb-oauth-callback`;
  const backendHost = (() => { try { return new URL(supabaseUrl).host; } catch { return supabaseUrl; } })();
  const frontendHost = typeof window !== "undefined" ? window.location.host : "";

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyText = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };
  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = (status?: string | null, isActive?: boolean) => {
    const s = status ?? (isActive ? "active" : "pending");
    if (s === "active") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">Active</Badge>;
    if (s === "failed") return <Badge variant="destructive">Failed</Badge>;
    if (s === "disconnected") return <Badge variant="secondary">Disconnected</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("fbPages.title")}</h2>
        <p className="text-muted-foreground">{t("fbPages.subtitle")}</p>
      </div>

      {/* Connect CTA */}
      <Card className="overflow-hidden border-2" style={{ borderColor: `${FB_BLUE}30` }}>
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: FB_BLUE }}>
              <Facebook className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Connect Facebook & Instagram</h3>
              <p className="text-sm text-muted-foreground">One click. Pick a page. We auto-subscribe DMs, comments, feed — and any linked Instagram Business account.</p>
            </div>
          </div>
          <Button
            size="lg"
            disabled={startOAuth.isPending}
            onClick={() => startOAuth.mutate()}
            className="text-white hover:opacity-90 shrink-0"
            style={{ backgroundColor: FB_BLUE }}
          >
            {startOAuth.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Facebook className="h-4 w-4 mr-2" />}
            Connect Facebook + Instagram
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Meta App configuration helper */}
      <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Seeing “domain of this URL isn’t included”? Configure your Meta App
          </CardTitle>
          <CardDescription>
            Facebook blocks the login dialog until your Meta App allows these exact values. Copy and paste them into your Facebook Developer settings, then try Connect again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium mb-1">1. Settings → Basic → App Domains (add all of these)</p>
            <div className="space-y-1.5">
              {[backendHost, frontendHost, "leadpilot.life"].filter(Boolean).map((d) => (
                <div key={d} className="flex items-center gap-2 bg-background rounded-md border px-3 py-2 font-mono text-xs">
                  <span className="flex-1 truncate">{d}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyText(d, `dom-${d}`)}>
                    {copiedField === `dom-${d}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">2. Use cases → Facebook Login → Settings → Valid OAuth Redirect URIs</p>
            <div className="flex items-center gap-2 bg-background rounded-md border px-3 py-2 font-mono text-xs">
              <span className="flex-1 truncate">{oauthRedirectUri}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyText(oauthRedirectUri, "redir")}>
                {copiedField === "redir" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">3. Site URL (Settings → Basic → + Add Platform → Website)</p>
            <div className="flex items-center gap-2 bg-background rounded-md border px-3 py-2 font-mono text-xs">
              <span className="flex-1 truncate">https://{frontendHost || "leadpilot.life"}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyText(`https://${frontendHost || "leadpilot.life"}`, "site")}>
                {copiedField === "site" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="pt-1">
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs font-medium"
            >
              Open Facebook Developer Console <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-3">
            Tip: after saving in Meta, wait ~30 seconds, then click Connect again. If your app is still in Development mode, make sure your Facebook account is added under App Roles → Roles/Testers.
          </p>
        </CardContent>
      </Card>

      {/* Connected pages */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Connected Pages</h3>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : !pages?.length ? (
          <Card className="p-10 text-center border-dashed">
            <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">No pages connected yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Click "Connect Facebook Page" above to get started.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pages.map((page) => (
              <Card key={page.id} className={!page.is_active ? "opacity-70" : ""}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {page.page_picture_url ? (
                        <img src={page.page_picture_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ backgroundColor: FB_BLUE }}>
                          <Facebook className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{page.page_name || "Unnamed Page"}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">ID: {page.fb_page_id}</p>
                      </div>
                    </div>
                    {statusBadge(page.subscription_status, page.is_active)}
                  </div>

                  {page.ig_username && (
                    <div className="flex items-center gap-2 text-xs bg-gradient-to-r from-fuchsia-500/10 to-orange-400/10 border border-fuchsia-500/20 rounded-md px-2 py-1.5">
                      <Instagram className="h-3.5 w-3.5 text-fuchsia-600" />
                      <span className="font-medium">@{page.ig_username}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className={page.ig_subscription_status === "active" ? "text-emerald-600" : "text-amber-600"}>
                        {page.ig_subscription_status === "active" ? "DMs + comments live" : (page.ig_subscription_status || "pending")}
                      </span>
                    </div>
                  )}

                  {page.subscription_error && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1">{page.subscription_error}</p>
                  )}

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {page.last_sync_at && <p>Last sync: {formatDistanceToNow(new Date(page.last_sync_at), { addSuffix: true })}</p>}
                    {page.connected_at && <p>Connected: {formatDistanceToNow(new Date(page.connected_at), { addSuffix: true })}</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate(page.id)}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${sync.isPending ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Button variant="outline" size="sm" disabled={testConn.isPending} onClick={() => testConn.mutate(page.id)}>
                      {testConn.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Activity className="h-3.5 w-3.5 mr-1" />}
                      {t("fb.testConnection")}
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDisconnectId(page.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook URL</CardTitle>
          <CardDescription>For reference. Pages connected through "Connect Facebook Page" are subscribed automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyWebhook}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual fallback */}
      <div>
        <button onClick={() => setShowManual(!showManual)} className="text-xs text-muted-foreground underline hover:text-foreground">
          {showManual ? "Hide" : "Advanced: paste a Page Access Token manually"}
        </button>
        {showManual && (
          <Card className="mt-3">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Facebook Page ID</Label>
                  <Input value={form.pageId} onChange={(e) => setForm((f) => ({ ...f, pageId: e.target.value }))} placeholder="123456789012345" />
                </div>
                <div className="space-y-2">
                  <Label>Page Name (optional)</Label>
                  <Input value={form.pageName} onChange={(e) => setForm((f) => ({ ...f, pageName: e.target.value }))} placeholder="My Shop" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Page Access Token</Label>
                <Input type="password" value={form.accessToken} onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))} />
              </div>
              <Button onClick={() => addManual.mutate()} disabled={addManual.isPending}>
                <Plus className="h-4 w-4 mr-1" />
                {addManual.isPending ? "Adding..." : "Add Page"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Page picker modal */}
      <Dialog open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) { setSessionToken(null); setSelectedPage(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select a Facebook Page</DialogTitle>
            <DialogDescription>Choose the page LeadPilot should manage. You can connect more later.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-2">
            {loadingSession ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !sessionPages?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No pages found on this Facebook account.</p>
            ) : (
              sessionPages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPage(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${selectedPage === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                >
                  {p.picture_url ? (
                    <img src={p.picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: FB_BLUE }}>
                      <Facebook className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {p.category && <span className="truncate">{p.category}</span>}
                      {p.ig_username && (
                        <span className="flex items-center gap-1 text-fuchsia-600">
                          <Instagram className="h-3 w-3" /> @{p.ig_username}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedPage === p.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedPage || connectPage.isPending}
              onClick={() => selectedPage && connectPage.mutate(selectedPage)}
              className="text-white"
              style={{ backgroundColor: FB_BLUE }}
            >
              {connectPage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirm */}
      <AlertDialog open={!!disconnectId} onOpenChange={(o) => !o && setDisconnectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this page?</AlertDialogTitle>
            <AlertDialogDescription>
              The bot will stop replying on this page. You can reconnect anytime with one click.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnectId && disconnect.mutate(disconnectId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FbPageConnection;
