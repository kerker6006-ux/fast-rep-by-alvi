import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, ShoppingCart, MessageSquare, Package, Globe, Coins, Plus,
  CheckCircle, XCircle, Trash2, Search, UserCheck, UserX, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminPanel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeNote, setRechargeNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
      toast.success(approve ? "User approved!" : "User rejected!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // Delete user data from all tables
      await Promise.all([
        supabase.from("products").delete().eq("user_id", userId),
        supabase.from("orders").delete().eq("user_id", userId),
        supabase.from("conversations").delete().eq("user_id", userId),
        supabase.from("auto_reply_rules").delete().eq("user_id", userId),
        supabase.from("scheduled_messages").delete().eq("user_id", userId),
        supabase.from("bot_settings").delete().eq("user_id", userId),
        supabase.from("complaints").delete().eq("user_id", userId),
        supabase.from("fb_pages").delete().eq("user_id", userId),
        supabase.from("user_credits").delete().eq("user_id", userId),
        supabase.from("credit_transactions").delete().eq("user_id", userId),
      ]);
      // Delete profile last
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User removed successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => toast.error("Failed to remove user: " + (err as Error).message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const pendingUsers = users?.filter(u => !u.is_approved) || [];
  const approvedUsers = users?.filter(u => u.is_approved) || [];

  const filterUsers = (list: typeof users) => {
    if (!list || !searchQuery) return list || [];
    const q = searchQuery.toLowerCase();
    return list.filter(u =>
      u.display_name?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    );
  };

  const UserCard = ({ u }: { u: NonNullable<typeof users>[0] }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{u.display_name || "Unnamed User"}</h3>
              {u.is_approved ? (
                <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Active
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  <Clock className="h-2.5 w-2.5 mr-0.5" /> Pending
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Joined {new Date(u.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md flex items-center gap-1 shrink-0">
            <Coins className="h-3 w-3" /> ৳{Number(u.creditBalance).toLocaleString()}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-md p-2 text-center">
            <Package className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
            <p className="text-xs font-bold">{u.productCount}</p>
            <p className="text-[10px] text-muted-foreground">Products</p>
          </div>
          <div className="bg-muted/50 rounded-md p-2 text-center">
            <ShoppingCart className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
            <p className="text-xs font-bold">{u.orderCount}</p>
            <p className="text-[10px] text-muted-foreground">Orders</p>
          </div>
          <div className="bg-muted/50 rounded-md p-2 text-center">
            <MessageSquare className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
            <p className="text-xs font-bold">{u.conversationCount}</p>
            <p className="text-[10px] text-muted-foreground">Chats</p>
          </div>
        </div>

        {/* FB Pages */}
        {u.fbPages.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {u.fbPages.map((page: any) => (
              <Badge key={page.fb_page_id} variant={page.is_active ? "default" : "secondary"} className="text-[10px]">
                <Globe className="h-2.5 w-2.5 mr-0.5" />
                {page.page_name || page.fb_page_id}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-border">
          {!u.is_approved ? (
            <>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => approvalMutation.mutate({ userId: u.id, approve: true })}
                disabled={approvalMutation.isPending}
              >
                <UserCheck className="h-3 w-3 mr-1" /> Approve
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="h-8 text-xs">
                    <XCircle className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject this user?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will keep the user in pending state. They won't be able to access the dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => {
                      toast.info("User remains in pending/rejected state.");
                    }}>
                      Confirm Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => approvalMutation.mutate({ userId: u.id, approve: false })}
              disabled={approvalMutation.isPending}
            >
              <UserX className="h-3 w-3 mr-1" /> Revoke Access
            </Button>
          )}

          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs">
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:bg-destructive/10 px-2">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove User Permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete <strong>{u.display_name || "this user"}</strong> and all their data (products, orders, conversations, etc.). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => deleteMutation.mutate({ userId: u.id })}
                >
                  Delete Forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-muted-foreground text-sm">Manage users, approvals, and credits.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users?.length || 0}</p>
              <p className="text-[11px] text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className={pendingUsers.length > 0 ? "bg-destructive/5 border-destructive/20" : ""}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${pendingUsers.length > 0 ? "bg-destructive/15" : "bg-muted"}`}>
              <Clock className={`h-5 w-5 ${pendingUsers.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingUsers.length}</p>
              <p className="text-[11px] text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users?.reduce((s, u) => s + u.fbPages.length, 0) || 0}</p>
              <p className="text-[11px] text-muted-foreground">FB Pages</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users?.reduce((s, u) => s + u.orderCount, 0) || 0}</p>
              <p className="text-[11px] text-muted-foreground">Total Orders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabbed Users View */}
      <Tabs defaultValue={pendingUsers.length > 0 ? "pending" : "approved"}>
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1 gap-1">
            <Clock className="h-3.5 w-3.5" />
            Pending
            {pendingUsers.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1 ml-1">{pendingUsers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex-1 gap-1">
            <UserCheck className="h-3.5 w-3.5" />
            Approved ({approvedUsers.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1 gap-1">
            <Users className="h-3.5 w-3.5" />
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-3 space-y-3">
          {filterUsers(pendingUsers).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-10 w-10 text-success mx-auto mb-2" />
                <p className="text-sm font-medium">No pending approvals</p>
                <p className="text-xs text-muted-foreground">All users have been reviewed</p>
              </CardContent>
            </Card>
          ) : (
            filterUsers(pendingUsers).map(u => <UserCard key={u.id} u={u} />)
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-3 space-y-3">
          {filterUsers(approvedUsers).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No approved users yet.</p>
          ) : (
            filterUsers(approvedUsers).map(u => <UserCard key={u.id} u={u} />)
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-3 space-y-3">
          {filterUsers(users).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
          ) : (
            filterUsers(users).map(u => <UserCard key={u.id} u={u} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
