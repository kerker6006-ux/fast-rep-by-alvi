import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Plus, Trash2, Copy, Check } from "lucide-react";

const FbPageConnection = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ pageId: "", pageName: "", accessToken: "" });

  const { data: pages, isLoading } = useQuery({
    queryKey: ["fb-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fb_pages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addPage = useMutation({
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
      setShowAdd(false);
      toast.success("Facebook Page connected!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fb_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fb-pages"] });
      toast.success("Page disconnected");
    },
  });

  const togglePage = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("fb_pages").update({ is_active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fb-pages"] }),
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fb-webhook`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Facebook Page Connection</h2>
        <p className="text-muted-foreground">Connect your Facebook Page to start receiving messages.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook URL</CardTitle>
          <CardDescription>All pages share the same webhook URL. Each page gets its own unique Verify Token shown below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyWebhook}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Pages</h3>
        <Button onClick={() => setShowAdd(!showAdd)} variant={showAdd ? "secondary" : "default"} className="gap-2">
          <Plus className="h-4 w-4" /> Add Page
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Facebook Page ID</Label>
                <Input
                  value={form.pageId}
                  onChange={(e) => setForm((f) => ({ ...f, pageId: e.target.value }))}
                  placeholder="123456789012345"
                />
              </div>
              <div className="space-y-2">
                <Label>Page Name (optional)</Label>
                <Input
                  value={form.pageName}
                  onChange={(e) => setForm((f) => ({ ...f, pageName: e.target.value }))}
                  placeholder="My Shop"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Page Access Token</Label>
              <Input
                type="password"
                value={form.accessToken}
                onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                placeholder="Paste your page access token here"
              />
              <p className="text-xs text-muted-foreground">Get this from Facebook Developer App → Your Page → Generate Token</p>
            </div>
            <Button onClick={() => addPage.mutate()} disabled={addPage.isPending}>
              {addPage.isPending ? "Connecting..." : "Connect Page"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : !pages?.length ? (
        <Card className="p-8 text-center">
          <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No pages connected</h3>
          <p className="text-sm text-muted-foreground mt-1">Add your Facebook Page to start using the bot.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pages.map((page: any) => (
            <Card key={page.id} className={!page.is_active ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{page.page_name || "Unnamed Page"}</span>
                    <Badge variant={page.is_active ? "default" : "secondary"} className="text-[10px]">
                      {page.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">ID: {page.fb_page_id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={page.is_active}
                    onCheckedChange={(checked) => togglePage.mutate({ id: page.id, is_active: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => deletePage.mutate(page.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FbPageConnection;
