import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Enrollment = {
  id: string;
  course_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  fb_user_id: string | null;
  payment_status: string;
  amount_paid: number | null;
  notes: string | null;
  granted_at: string | null;
  created_at: string;
  courses?: { title: string; currency: string } | null;
};

const EnrollmentsManager = () => {
  const { activePage } = useActivePage();
  const qc = useQueryClient();
  const pageId = activePage?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ["enrollments", pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select("*, courses(title, currency)")
        .eq("fb_page_id", pageId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Enrollment[];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (e: Enrollment) => {
      const { error } = await supabase.from("course_enrollments").update({
        payment_status: "paid",
        granted_at: new Date().toISOString(),
      }).eq("id", e.id);
      if (error) throw error;
      // Trigger lesson delivery via send-fb-message edge function
      if (e.fb_user_id && pageId) {
        await supabase.functions.invoke("send-fb-message", {
          body: {
            fb_page_row_id: pageId,
            recipient_id: e.fb_user_id,
            deliver_course_id: e.course_id,
          },
        }).catch(() => {/* non-blocking */});
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["enrollments", pageId] }); toast.success("Marked paid — access sent"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!activePage) return <Card className="p-10 text-center"><p className="text-muted-foreground">Select a page first.</p></Card>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Enrollments</h2>
        <p className="text-sm text-muted-foreground">Buyers who requested or paid for your courses.</p>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : data.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p>No enrollments yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map(e => (
            <Card key={e.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{e.customer_name || "Unknown"} <span className="text-muted-foreground text-xs">· {e.courses?.title}</span></p>
                  <p className="text-xs text-muted-foreground">{e.customer_phone || e.fb_user_id} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                  {e.notes && <p className="text-xs text-muted-foreground mt-1">{e.notes}</p>}
                </div>
                <Badge variant={e.payment_status === "paid" ? "default" : "secondary"}>{e.payment_status}</Badge>
                {e.payment_status !== "paid" && (
                  <Button size="sm" onClick={() => markPaid.mutate(e)} disabled={markPaid.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Mark paid + send access
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnrollmentsManager;
