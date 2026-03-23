import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Phone, MapPin, User } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const OrdersManager = () => {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, conversations(sender_name, fb_sender_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}</div>;

  if (!orders?.length) {
    return (
      <div className="text-center py-16">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold">No orders yet</h3>
        <p className="text-muted-foreground">Orders placed via Messenger will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
        <p className="text-muted-foreground">Manage orders placed through Messenger.</p>
      </div>
      <div className="grid gap-4">
        {orders.map((order: any) => (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Order #{order.id.slice(0, 8)}
                </CardTitle>
                <Badge className={statusColors[order.status] || ""}>{order.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                {order.customer_name && (
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {order.customer_name}</span>
                )}
                {order.customer_phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order.customer_phone}</span>
                )}
                {order.customer_address && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.customer_address}</span>
                )}
              </div>

              {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-xs font-medium mb-2">Items:</p>
                  {order.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.name} × {item.quantity}</span>
                      <span>৳{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-sm">
                    <span>Total</span>
                    <span>৳{order.total}</span>
                  </div>
                </div>
              )}

              <Select
                value={order.status}
                onValueChange={(status) => updateStatus.mutate({ id: order.id, status })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OrdersManager;
