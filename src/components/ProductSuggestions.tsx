import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lightbulb, Check, X, Trash2, Repeat } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Suggestion = {
  id: string;
  customer_name: string | null;
  requested_product: string;
  message_snippet: string | null;
  request_count: number;
  status: string;
  created_at: string;
  updated_at: string;
};

const ProductSuggestions = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["product-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_suggestions" as any)
        .select("*")
        .order("request_count", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Suggestion[];
    },
    refetchInterval: 15000,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("product_suggestions" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-suggestions"] });
      toast.success("Updated");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_suggestions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-suggestions"] });
      toast.success("Removed");
    },
  });

  const pending = data?.filter(s => s.status === "pending") || [];
  const others = data?.filter(s => s.status !== "pending") || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-primary" /> {t("suggestions.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("suggestions.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
      ) : !data?.length ? (
        <Card className="p-8 text-center">
          <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No suggestions yet. When customers ask about products you don't have, they'll show up here.
          </p>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Pending ({pending.length})</h3>
              {pending.map(s => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start justify-between gap-3">
                      <span className="flex-1">{s.requested_product}</span>
                      <Badge variant="default" className="shrink-0 gap-1">
                        <Repeat className="h-3 w-3" />
                        {s.request_count} {s.request_count === 1 ? "request" : "requests"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {s.customer_name && <>Asked by <strong>{s.customer_name}</strong> · </>}
                      Last: {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {s.message_snippet && (
                      <p className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">
                        "{s.message_snippet}"
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => setStatus.mutate({ id: s.id, status: "added" })} className="gap-1">
                        <Check className="h-4 w-4" /> Mark as Added
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: "ignored" })} className="gap-1">
                        <X className="h-4 w-4" /> Ignore
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)} className="gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {others.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">History ({others.length})</h3>
              {others.map(s => (
                <Card key={s.id} className="opacity-70">
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{s.requested_product}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.request_count} requests · <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductSuggestions;
