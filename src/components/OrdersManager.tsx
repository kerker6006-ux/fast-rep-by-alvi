import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Package, Phone, MapPin, User, Calendar as CalendarIcon,
  FileText, Pencil, Trash2, X, Search, ShoppingCart,
  Clock, CheckCircle, Truck, XCircle, Settings2, Download,
} from "lucide-react";

type OrderStatus = "pending" | "confirmed" | "processing" | "delivered" | "cancelled";

const statusConfig: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "text-primary", bgColor: "bg-primary/5 border-primary/20" },
  processing: { label: "Processing", icon: Settings2, color: "text-violet-600", bgColor: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800" },
  delivered: { label: "Delivered", icon: Truck, color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/5 border-destructive/20" },
};

const OrdersManager = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");

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
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order status updated");
    },
    onError: (e: any) => { console.error("Status update error:", e); toast.error(e.message); },
  });

  const updateOrder = useMutation({
    mutationFn: async (order: any) => {
      const { error } = await supabase.from("orders").update({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
        notes: order.notes,
        total: order.total,
      }).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order updated");
      setEditingOrder(null);
      setSelectedOrder(null);
    },
    onError: (e: any) => { console.error("Order update error:", e); toast.error(e.message); },
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
    onError: (e: any) => { console.error("Order delete error:", e); toast.error(e.message); },
  });

  const filteredOrders = orders?.filter((o: any) => {
    if (statusTab !== "all" && o.status !== statusTab) return false;
    if (dateFilter) {
      const d = new Date(o.created_at);
      if (d.getFullYear() !== dateFilter.getFullYear() || d.getMonth() !== dateFilter.getMonth() || d.getDate() !== dateFilter.getDate()) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!o.customer_name?.toLowerCase().includes(q) && !o.customer_phone?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getCount = (status: string) => orders?.filter((o: any) => o.status === status).length || 0;

  const exportCSV = () => {
    const data = filteredOrders || [];
    if (!data.length) { toast.error("No orders to export"); return; }
    const headers = ["Order ID", "Customer Name", "Phone", "Address", "Status", "Total (৳)", "Items", "Notes", "Date"];
    const rows = data.map((o: any) => [
      o.id.slice(0, 8),
      o.customer_name || o.conversations?.sender_name || "",
      o.customer_phone || "",
      o.customer_address || "",
      o.status,
      o.total,
      Array.isArray(o.items) ? o.items.map((i: any) => `${i.name} x${i.quantity}`).join("; ") : "",
      o.notes || "",
      new Date(o.created_at).toLocaleString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Orders exported!");
  };

  if (isLoading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground text-sm">Manage orders from Messenger.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-2">
        {(Object.keys(statusConfig) as OrderStatus[]).map(s => {
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          const count = getCount(s);
          return (
            <button
              key={s}
              onClick={() => setStatusTab(statusTab === s ? "all" : s)}
              className={cn(
                "rounded-lg border p-2 text-center transition-all",
                statusTab === s ? cfg.bgColor + " ring-1 ring-offset-1" : "bg-card hover:bg-muted/50",
              )}
            >
              <Icon className={cn("h-4 w-4 mx-auto mb-0.5", cfg.color)} />
              <p className="text-lg font-bold leading-tight">{count}</p>
              <p className="text-[9px] text-muted-foreground capitalize leading-tight">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search + Date Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1 h-9 shrink-0", dateFilter && "border-primary text-primary")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFilter ? format(dateFilter, "dd MMM") : "Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {dateFilter && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setDateFilter(undefined)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Active filter indicator */}
      {statusTab !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            Showing: {statusConfig[statusTab as OrderStatus]?.label}
            <button onClick={() => setStatusTab("all")} className="ml-1 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
          <span className="text-xs text-muted-foreground">{filteredOrders?.length || 0} orders</span>
        </div>
      )}

      {/* Order List */}
      {!filteredOrders?.length ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No orders found</h3>
          <p className="text-sm text-muted-foreground">
            {statusTab !== "all" ? `No ${statusConfig[statusTab as OrderStatus]?.label.toLowerCase()} orders.` : "Orders from Messenger will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order: any) => {
            const cfg = statusConfig[order.status as OrderStatus] || statusConfig.pending;
            const Icon = cfg.icon;
            const displayName = order.customer_name || order.conversations?.sender_name || `Order #${order.id.slice(0, 6)}`;

            return (
              <Card
                key={order.id}
                className={cn("cursor-pointer transition-all hover:shadow-md border-l-4", `border-l-current ${cfg.color}`)}
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{displayName}</h3>
                        <Badge className={cn("text-[10px] shrink-0 border", cfg.bgColor, cfg.color)}>
                          <Icon className="h-2.5 w-2.5 mr-0.5" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {order.customer_phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="h-3 w-3" /> {order.customer_phone}
                          </span>
                        )}
                        <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                      {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {order.items.map((i: any) => `${i.name} ×${i.quantity}`).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">৳{Number(order.total).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">#{order.id.slice(0, 6)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder && !editingOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Order #{selectedOrder?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const cfg = statusConfig[selectedOrder.status as OrderStatus] || statusConfig.pending;
            return (
              <div className="space-y-4">
                {/* Status Control */}
                <div className={cn("rounded-lg p-3 border flex items-center justify-between", cfg.bgColor)}>
                  <div className="flex items-center gap-2">
                    <cfg.icon className={cn("h-5 w-5", cfg.color)} />
                    <span className={cn("font-semibold text-sm", cfg.color)}>{cfg.label}</span>
                  </div>
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(status) => {
                      updateStatus.mutate({ id: selectedOrder.id, status });
                      setSelectedOrder({ ...selectedOrder, status });
                    }}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusConfig) as OrderStatus[]).map(s => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-1.5">
                            {statusConfig[s].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Info */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Info</p>
                  <div className="grid gap-2 text-sm">
                    {selectedOrder.customer_name && (
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground shrink-0" /> <span>{selectedOrder.customer_name}</span></div>
                    )}
                    {selectedOrder.customer_phone && (
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /> <span>{selectedOrder.customer_phone}</span></div>
                    )}
                    {selectedOrder.customer_address && (
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground shrink-0" /> <span>{selectedOrder.customer_address}</span></div>
                    )}
                    {selectedOrder.conversations?.sender_name && (
                      <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground shrink-0" /> <span>FB: {selectedOrder.conversations.sender_name}</span></div>
                    )}
                    <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" /> <span>{new Date(selectedOrder.created_at).toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Items */}
                {selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Items</p>
                    {selectedOrder.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                        <span>{item.name} <span className="text-muted-foreground">× {item.quantity}</span></span>
                        <span className="font-medium">৳{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="border-t-2 border-border mt-2 pt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-primary">৳{Number(selectedOrder.total).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
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
            );
          })()}
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
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
