import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Trash2, ShieldCheck, Eye, Loader2 } from "lucide-react";

const TeamAccessCard = () => {
  const { activePage, accessRole } = useActivePage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"full" | "moderator">("moderator");
  const [sending, setSending] = useState(false);
  const pageId = activePage?.id;

  const canManage = accessRole === "owner" || accessRole === "full";

  const { data: members = [], refetch: refetchMembers } = useQuery({
    queryKey: ["page-members", pageId],
    enabled: !!pageId && canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_members")
        .select("id, user_id, role, created_at, profiles:profiles!page_members_user_id_fkey(display_name, full_name)")
        .eq("page_id", pageId!);
      if (error) {
        // fallback without join if FK alias missing
        const { data: d2 } = await supabase
          .from("page_members")
          .select("id, user_id, role, created_at")
          .eq("page_id", pageId!);
        return d2 ?? [];
      }
      return data ?? [];
    },
  });

  const { data: invites = [], refetch: refetchInvites } = useQuery({
    queryKey: ["page-invites", pageId],
    enabled: !!pageId && canManage,
    queryFn: async () => {
      const { data } = await supabase
        .from("page_invites")
        .select("id, email, role, status, created_at, expires_at")
        .eq("page_id", pageId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!activePage || !canManage) return null;

  const sendInvite = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(e)) {
      toast.error("Only @gmail.com addresses can be invited.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("invite-page-member", {
      body: { page_id: pageId, email: e, role },
    });
    setSending(false);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Failed to send invite.");
      return;
    }
    toast.success(`Invite sent to ${e}`);
    setEmail("");
    setRole("moderator");
    setOpen(false);
    refetchInvites();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.functions.invoke("revoke-page-invite", { body: { invite_id: id } });
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    refetchInvites();
  };

  const removeMember = async (id: string) => {
    if (!confirm("Remove this teammate from the page?")) return;
    const { error } = await supabase.functions.invoke("remove-page-member", { body: { member_id: id } });
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    refetchMembers();
    qc.invalidateQueries({ queryKey: ["active-pages"] });
  };

  return (
    <Card className="p-6 rounded-2xl shadow-soft space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-bold text-lg">Team & Access</h3>
          <p className="text-sm text-muted-foreground">
            Invite people to help manage <strong>{activePage.page_name}</strong>. Only this page is shared — your other pages stay private.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <UserPlus className="h-4 w-4 mr-2" /> Invite teammate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite a teammate</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Gmail address</Label>
                <Input
                  type="email"
                  placeholder="teammate@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Only @gmail.com addresses can be invited.</p>
              </div>
              <div className="space-y-2">
                <Label>Access level</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as any)} className="space-y-2">
                  <label className="flex items-start gap-3 border rounded-xl p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="full" className="mt-1" />
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Full Access</div>
                      <p className="text-xs text-muted-foreground">Can do everything except disconnecting the page. Can also invite/remove other teammates.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 border rounded-xl p-3 cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="moderator" className="mt-1" />
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Moderator</div>
                      <p className="text-xs text-muted-foreground">Only sees conversations, orders, and callback requests. Can reply but cannot change settings, products, or billing.</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={sendInvite} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Members</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between border rounded-xl px-3 py-2.5 bg-muted/30">
            <div className="text-sm">
              <span className="font-medium">Owner</span>
              <p className="text-[11px] text-muted-foreground">Full control, including disconnecting the page.</p>
            </div>
            <Badge variant="secondary">Owner</Badge>
          </div>
          {members.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">No teammates yet.</p>
          )}
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between border rounded-xl px-3 py-2.5">
              <div className="text-sm">
                <p className="font-medium">{m.profiles?.display_name || m.profiles?.full_name || m.user_id.slice(0, 8)}</p>
                <p className="text-[11px] text-muted-foreground">{m.role === "full" ? "Full Access" : "Moderator"}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {invites.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pending invites</div>
          {invites.map((iv: any) => (
            <div key={iv.id} className="flex items-center justify-between border rounded-xl px-3 py-2.5 bg-amber-50/40">
              <div className="text-sm">
                <p className="font-medium">{iv.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  {iv.role === "full" ? "Full Access" : "Moderator"} · expires {new Date(iv.expires_at).toLocaleDateString()}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke(iv.id)}>Revoke</Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TeamAccessCard;
