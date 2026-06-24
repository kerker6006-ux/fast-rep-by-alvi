import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, Phone, User, Calendar, MessageSquare } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  "in-progress": "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
};

const ComplaintsManager = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const [selected, setSelected] = useState<any>(null);
  const [adminNote, setAdminNote] = useState("");

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["complaints", activePage?.id],
    enabled: !!user?.id && !!activePage?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select("*, conversations(sender_name, fb_sender_id)")
        .eq("fb_page_id", activePage!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateComplaint = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: string; notes?: string }) => {
      const update: any = { updated_at: new Date().toISOString() };
      if (status) update.status = status;
      if (notes !== undefined) update.notes = notes;
      const { error } = await supabase.from("complaints").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast.success("Complaint updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;

  if (!complaints?.length) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold">{t("complaints.empty")}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("complaints.title")}</h2>
        <p className="text-muted-foreground">{t("complaints.subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["pending", "in-progress", "resolved", "closed"].map(s => (
          <Card key={s}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{complaints.filter((c: any) => c.status === s).length}</p>
              <p className="text-xs text-muted-foreground capitalize">{s}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {complaints.map((complaint: any) => (
          <Card
            key={complaint.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setSelected(complaint); setAdminNote(complaint.notes || ""); }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Complaint #{complaint.id.slice(0, 8)}
                </CardTitle>
                <Badge className={statusColors[complaint.status] || ""}>{complaint.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(complaint.created_at).toLocaleString()}</p>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm line-clamp-2">{complaint.complaint_text}</p>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                {complaint.customer_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{complaint.customer_name}</span>}
                {complaint.customer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{complaint.customer_phone}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Complaint #{selected?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={statusColors[selected.status] || ""}>{selected.status}</Badge>
                <Select
                  value={selected.status}
                  onValueChange={(status) => {
                    updateComplaint.mutate({ id: selected.id, status });
                    setSelected({ ...selected, status });
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold">Customer Info</p>
                <div className="grid gap-2 text-sm">
                  {selected.customer_name && (
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Name:</span> {selected.customer_name}</div>
                  )}
                  {selected.customer_phone && (
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Phone:</span> {selected.customer_phone}</div>
                  )}
                  {selected.conversations?.sender_name && (
                    <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" /><span className="font-medium">FB:</span> {selected.conversations.sender_name}</div>
                  )}
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Date:</span> {new Date(selected.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-destructive mb-1">Complaint</p>
                <p className="text-sm whitespace-pre-wrap">{selected.complaint_text}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Admin Notes</p>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add notes about this complaint..."
                  rows={3}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    updateComplaint.mutate({ id: selected.id, notes: adminNote });
                    setSelected({ ...selected, notes: adminNote });
                  }}
                >
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintsManager;
