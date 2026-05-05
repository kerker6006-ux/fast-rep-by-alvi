import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Trash2, Loader2, ExternalLink } from "lucide-react";

const WebsiteImport = () => {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("https://korean-skincare-bd.lovable.app/");
  const [maxPages, setMaxPages] = useState(50);
  const [importProducts, setImportProducts] = useState(true);

  const { data: knowledge, isLoading } = useQuery({
    queryKey: ["website-knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_knowledge" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const scrape = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url, maxPages, importProducts },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Scraped ${data.pages_scraped} pages • Saved ${data.knowledge_saved} to knowledge base • Imported ${data.products_imported} products`
      );
      queryClient.invalidateQueries({ queryKey: ["website-knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["pending-products"] });
    },
    onError: (e: any) => toast.error(e.message || "Scrape failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("website_knowledge" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["website-knowledge"] });
      toast.success("Removed");
    },
  });

  const grouped = (knowledge || []).reduce((acc: Record<string, any[]>, k: any) => {
    (acc[k.source_url] ||= []).push(k);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Website Knowledge Import</h2>
        <p className="text-muted-foreground">
          Scrape any website and feed its content + products into your bot.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import from Website</CardTitle>
          <CardDescription>
            The bot will use the scraped content to answer customer questions and (optionally) add product pages to Auto-Import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Website URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max pages</Label>
              <Input
                type="number"
                value={maxPages}
                min={1}
                max={100}
                onChange={(e) => setMaxPages(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Auto-extract products</Label>
              <div className="flex items-center h-10 gap-2">
                <Switch checked={importProducts} onCheckedChange={setImportProducts} />
                <span className="text-sm text-muted-foreground">
                  Sends product pages to Auto-Import for review
                </span>
              </div>
            </div>
          </div>
          <Button onClick={() => scrape.mutate()} disabled={scrape.isPending} className="gap-2">
            {scrape.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Scraping… (1-3 min)
              </>
            ) : (
              <>
                <Globe className="h-4 w-4" /> Start Import
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-3">Imported Knowledge</h3>
        {isLoading ? (
          <div className="h-20 bg-muted animate-pulse rounded-lg" />
        ) : !knowledge?.length ? (
          <Card className="p-8 text-center">
            <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([src, pages]) => {
              const list = pages as any[];
              return (
              <Card key={src}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    {src}
                    <Badge variant="secondary">{list.length} pages</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-3 text-sm border-t pt-2 first:border-0 first:pt-0">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.title || p.page_url}</div>
                        <a
                          href={p.page_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1"
                        >
                          {p.page_url} <ExternalLink className="h-3 w-3" />
                        </a>
                        {p.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.summary}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebsiteImport;
