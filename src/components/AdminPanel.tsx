import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ShoppingCart, MessageSquare, Package, Globe } from "lucide-react";

const AdminPanel = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, display_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get stats for each user
      const enriched = await Promise.all(
        (profiles || []).map(async (profile) => {
          const [products, orders, conversations, fbPages] = await Promise.all([
            supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("fb_pages").select("fb_page_id, page_name, is_active").eq("user_id", profile.id),
          ]);
          return {
            ...profile,
            productCount: products.count || 0,
            orderCount: orders.count || 0,
            conversationCount: conversations.count || 0,
            fbPages: fbPages.data || [],
          };
        })
      );
      return enriched;
    },
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
        <p className="text-muted-foreground">
          Overview of all users using your bot platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected Pages</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users?.reduce((sum, u) => sum + u.fbPages.length, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users?.reduce((sum, u) => sum + u.productCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users?.reduce((sum, u) => sum + u.orderCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {!users?.length ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{u.display_name || "Unnamed"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" /> {u.productCount} products
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" /> {u.orderCount} orders
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {u.conversationCount} chats
                      </span>
                    </div>
                    {u.fbPages.length > 0 && (
                      <div className="flex gap-1.5 mt-1">
                        {u.fbPages.map((page: any) => (
                          <Badge
                            key={page.fb_page_id}
                            variant={page.is_active ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {page.page_name || page.fb_page_id}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
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
