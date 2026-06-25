import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ImageIcon, Download, Check, Loader2, Globe, ChevronRight } from "lucide-react";

interface FbPost {
  id: string;
  message: string;
  created_time: string;
  image_url: string | null;
  has_image: boolean;
  already_imported: boolean;
}

const FbPostsBrowser = () => {
  const queryClient = useQueryClient();
  const { activePage } = useActivePage();
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fb-posts", activePage?.fb_page_id, afterCursor],
    enabled: !!activePage?.fb_page_id,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activePage?.fb_page_id) params.set("fb_page_id", activePage.fb_page_id);
      if (afterCursor) params.set("after", afterCursor);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-fb-posts?${params.toString()}`;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fetch posts" }));
        throw new Error(err.error || "Failed to fetch posts");
      }
      return res.json();
    },
  });


  const importMutation = useMutation({
    mutationFn: async (post: FbPost) => {
      setImportingId(post.id);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-fb-post`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: post.id,
          message: post.message,
          image_url: post.image_url,
          fb_page_id: activePage?.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Post imported! Check Pending Review tab.");
      queryClient.invalidateQueries({ queryKey: ["fb-posts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-products"] });
      setImportingId(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setImportingId(null);
    },
  });

  const posts: FbPost[] = data?.posts || [];
  const nextCursor = data?.paging?.cursors?.after;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your Facebook posts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">Could not load posts</h3>
        <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        <p className="text-xs text-muted-foreground mt-2">Make sure you have a Facebook Page connected.</p>
      </Card>
    );
  }

  if (!posts.length) {
    return (
      <Card className="p-8 text-center">
        <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">No posts found</h3>
        <p className="text-sm text-muted-foreground mt-1">Your Facebook Page doesn't have any posts yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Select posts to import as products. AI will analyze the image and fill details.
        </p>
        <Badge variant="secondary" className="text-xs">{posts.length} posts</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => {
          const isImporting = importingId === post.id;
          const hasPhoto = post.has_image && post.image_url;
          const isRecommended = hasPhoto;

          return (
            <Card
              key={post.id}
              className={`overflow-hidden transition-all hover:shadow-md ${
                post.already_imported ? "opacity-60" : ""
              } ${isRecommended && !post.already_imported ? "ring-2 ring-primary/30" : ""}`}
            >
              {/* Image */}
              <div className="aspect-square bg-muted relative overflow-hidden">
                {post.image_url ? (
                  <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
                {isRecommended && !post.already_imported && (
                  <Badge className="absolute top-2 left-2 text-[10px] bg-primary">
                    ✨ Recommended
                  </Badge>
                )}
                {post.already_imported && (
                  <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
                    <Check className="h-3 w-3 mr-1" /> Imported
                  </Badge>
                )}
              </div>

              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {post.message || "No caption"}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {new Date(post.created_time).toLocaleDateString("en-US", {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </p>

                {post.already_imported ? (
                  <Button size="sm" variant="ghost" className="w-full gap-1" disabled>
                    <Check className="h-3 w-3" /> Already Imported
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => importMutation.mutate(post)}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</>
                    ) : (
                      <><Download className="h-3 w-3" /> Import as Product</>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => setAfterCursor(nextCursor)} className="gap-1">
            Load More Posts <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FbPostsBrowser;
