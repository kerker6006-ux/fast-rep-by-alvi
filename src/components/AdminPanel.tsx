import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, ShoppingCart, MessageSquare, Package, Globe, Coins, Plus, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";

const AdminPanel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeNote, setRechargeNote] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, display_name, created_at, is_approved")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all(
        (profiles || []).map(async (profile) => {
          const [products, orders, conversations, fbPages, credits] = await Promise.all([
            supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("fb_pages").select("fb_page_id, page_name, is_active").eq("user_id", profile.id),
            supabase.from("user_credits").select("balance").eq("user_id", profile.id).maybeSingle(),
          ]);
          return {
            ...profile,
            productCount: products.count || 0,
            orderCount: orders.count || 0,
            conversationCount: conversations.count || 0,
            fbPages: fbPages.data || [],
            creditBalance: credits.data?.balance ?? 0,
          };
        })
      );
      return enriched;
    },
  });

  const rechargeMutation = useMutation({
    mutationFn: async ({ userId, amount, note }: { userId: string; amount: number; note: string }) => {
      const { data: existing } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_credits")
          .update({ balance: Number(existing.balance) + amount, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_credits")
          .insert({ user_id: userId, balance: amount });
        if (error) throw error;
      }

      const { error: txError } = await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount,
        type: "recharge",
        description: note || "bKash recharge by admin",
        admin_id: user?.id,
      });
      if (txError) throw txError;
    },
    onSuccess: () => {
      toast.success("Credits added successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setRechargeAmount("");
      setRechargeNote("");
    },
    onError: () => toast.error("Failed to add credits"),
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: approve })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { approve }) => {
      toast.success(approve ? "User approved!" : "User approval revoked!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to update approval status"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const pendingUsers = users?.filter(u => !u.is_approved) || [];
  const approvedUsers = users?.filter(u => u.is_approved) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-muted-foreground">Manage users, approvals, and credits.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{users?.length || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{pendingUsers.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected Pages</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{users?.reduce((s, u) => s + u.fbPages.length, 0) || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{users?.reduce((s, u) => s + u.orderCount, 0) || 0}</div></CardContent>
        </Card>
      </div>

      {/* Pending Approval Section */}
      {pendingUsers.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Pending Approval ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between border-b pb-3 last:border-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{u.display_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined: {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approvalMutation.mutate({ userId: u.id, approve: true })}
                      disabled={approvalMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users & Credits</CardTitle>
        </CardHeader>
        <CardContent>
          {!users?.length ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between border-b pb-3 last:border-0 gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{u.display_name || "Unnamed"}</p>
                      {u.is_approved ? (
                        <Badge variant="default" className="text-[10px]">Approved</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Pending</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {u.productCount}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {u.orderCount}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {u.conversationCount}</span>
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <Coins className="h-3 w-3 text-amber-500" /> ৳{Number(u.creditBalance).toLocaleString()}
                      </span>
                    </div>
                    {u.fbPages.length > 0 && (
                      <div className="flex gap-1.5 mt-1">
                        {u.fbPages.map((page: any) => (
                          <Badge key={page.fb_page_id} variant={page.is_active ? "default" : "secondary"} className="text-[10px]">
                            {page.page_name || page.fb_page_id}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!u.is_approved ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approvalMutation.mutate({ userId: u.id, approve: true })}
                        disabled={approvalMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => approvalMutation.mutate({ userId: u.id, approve: false })}
                        disabled={approvalMutation.isPending}
                      >
                        Revoke
                      </Button>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="h-3 w-3 mr-1" /> Credits
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Credits — {u.display_name || "User"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <p className="text-sm text-muted-foreground">
                            Current balance: <span className="font-bold text-foreground">৳{Number(u.creditBalance).toLocaleString()}</span>
                          </p>
                          <Input
                            type="number"
                            placeholder="Amount (৳)"
                            value={rechargeAmount}
                            onChange={(e) => setRechargeAmount(e.target.value)}
                          />
                          <Input
                            placeholder="Note (e.g., bKash TrxID: ABC123)"
                            value={rechargeNote}
                            onChange={(e) => setRechargeNote(e.target.value)}
                          />
                          <DialogClose asChild>
                            <Button
                              className="w-full"
                              disabled={!rechargeAmount || Number(rechargeAmount) <= 0}
                              onClick={() => {
                                rechargeMutation.mutate({
                                  userId: u.id,
                                  amount: Number(rechargeAmount),
                                  note: rechargeNote,
                                });
                              }}
                            >
                              Add ৳{rechargeAmount || "0"} Credits
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
