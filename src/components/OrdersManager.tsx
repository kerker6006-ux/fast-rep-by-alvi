import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Package, Phone, MapPin, User, Eye, Calendar as CalendarIcon, FileText, Pencil, Trash2, X } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const OrdersManager = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

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

  const updateOrder = useMutation({
    mutationFn: async (order: any) => {
      const { error } = await supabase.from("orders").update({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
        notes: order.notes,
        total: order.total,
      } as any).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order updated");
      setEditingOrder(null);
      setSelectedOrder(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order deleted");
      setDeleteOrderId(null);
      setSelectedOrder(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredOrders = orders?.filter((o: any) => {
    if (!dateFilter) return true;
    const orderDate = new Date(o.created_at);
    return (
      orderDate.getFullYear() === dateFilter.getFullYear() &&
      orderDate.getMonth() === dateFilter.getMonth() &&
      orderDate.getDate() === dateFilter.getDate()
    );
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground">Manage orders placed through Messenger.</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", dateFilter && "border-primary text-primary")}>
                <CalendarIcon className="h-4 w-4" />
                {dateFilter ? format(dateFilter, "dd MMM yyyy") : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={setDateFilter}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {dateFilter && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDateFilter(undefined)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {orders && orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {["pending", "confirmed", "processing", "delivered", "cancelled"].map(s => (
            <Card key={s}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{orders.filter((o: any) => o.status === s).length}</p>
                <p className="text-xs text-muted-foreground capitalize">{s}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!filteredOrders?.length ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">{dateFilter ? "No orders on this date" : "No orders yet"}</h3>
          <p className="text-muted-foreground">{dateFilter ? "Try selecting a different date." : "Orders placed via Messenger will appear here."}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order: any) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedOrder(order)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    Order #{order.id.slice(0, 8)}
                  </CardTitle>
                  <Badge className={statusColors[order.status] || ""}>{order.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-4 text-sm">
                  {order.customer_name && (
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {order.customer_name}</span>
                  )}
                  {order.customer_phone && (
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order.customer_phone}</span>
                  )}
                  <span className="font-semibold ml-auto">৳{order.total}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder && !editingOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={statusColors[selectedOrder.status] || ""}>
                  {selectedOrder.status}
                </Badge>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(status) => {
                    updateStatus.mutate({ id: selectedOrder.id, status });
                    setSelectedOrder({ ...selectedOrder, status });
                  }}
                >
                  <SelectTrigger className="w-[160px]">
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
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold mb-2">Customer Info</p>
                <div className="grid gap-2 text-sm">
                  {selectedOrder.customer_name && (
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Name:</span> {selectedOrder.customer_name}</div>
                  )}
                  {selectedOrder.customer_phone && (
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Phone:</span> {selectedOrder.customer_phone}</div>
                  )}
                  {selectedOrder.customer_address && (
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Address:</span> {selectedOrder.customer_address}</div>
                  )}
                  {selectedOrder.conversations?.sender_name && (
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="font-medium">FB:</span> {selectedOrder.conversations.sender_name}</div>
                  )}
                  <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Date:</span> {new Date(selectedOrder.created_at).toLocaleString()}</div>
                </div>
              </div>

              {selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-semibold mb-2">Items</p>
                  {selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span>{item.name} × {item.quantity}</span>
                      <span>৳{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t mt-2 pt-2 flex justify-between font-bold text-sm">
                    <span>Total</span>
                    <span>৳{selectedOrder.total}</span>
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-semibold mb-1">Notes</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditingOrder({ ...selectedOrder })}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="destructive" size="sm" className="gap-1" onClick={() => setDeleteOrderId(selectedOrder.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Order #{editingOrder?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Customer Name</label>
                <Input value={editingOrder.customer_name || ""} onChange={(e) => setEditingOrder({ ...editingOrder, customer_name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input value={editingOrder.customer_phone || ""} onChange={(e) => setEditingOrder({ ...editingOrder, customer_phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Input value={editingOrder.customer_address || ""} onChange={(e) => setEditingOrder({ ...editingOrder, customer_address: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Total (৳)</label>
                <Input type="number" value={editingOrder.total || 0} onChange={(e) => setEditingOrder({ ...editingOrder, total: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea value={editingOrder.notes || ""} onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })} rows={3} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
                <Button onClick={() => updateOrder.mutate(editingOrder)} disabled={updateOrder.isPending}>
                  {updateOrder.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The order will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteOrderId && deleteOrder.mutate(deleteOrderId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersManager;
