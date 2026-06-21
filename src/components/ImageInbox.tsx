import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Image as ImageIcon, User, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type ImgMsg = {
  id: string;
  conversation_id: string;
  image_url: string;
  content: string | null;
  created_at: string;
  conversations: { id: string; sender_name: string | null; fb_sender_id: string; last_message_at: string | null } | null;
};

const ImageInbox = () => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<ImgMsg | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const { data: images = [], isLoading, refetch } = useQuery({
    queryKey: ["image-inbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, image_url, content, created_at, conversations!inner(id, sender_name, fb_sender_id, last_message_at)")
        .eq("user_id", user!.id)
        .eq("direction", "incoming")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  const send = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-fb-message", {
        body: { conversation_id: selected.conversation_id, text: reply },
      });
      if (error) throw error;
      toast.success("Reply sent");
      setReply(""); setSelected(null); refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ImageIcon className="h-6 w-6 text-primary" /> Image Inbox</h2>
        <p className="text-muted-foreground">Images sent by customers. Click to view full size and reply.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : images.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No customer images yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <button key={img.id} onClick={() => setSelected(img)} className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all">
              <img src={img.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-xs">
                <p className="font-medium truncate flex items-center gap-1"><User className="h-3 w-3" />{img.conversations?.sender_name || `…${img.conversations?.fb_sender_id?.slice(-6)}`}</p>
                <p className="opacity-80">{formatDistanceToNow(new Date(img.created_at), { addSuffix: true })}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg overflow-hidden max-h-[60vh] flex items-center justify-center">
                <img src={selected.image_url} alt="" className="max-w-full max-h-[60vh] object-contain" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{selected.conversations?.sender_name || "Customer"}</p>
                <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString()}</p>
                {selected.content && <p className="mt-2 italic">"{selected.content}"</p>}
              </div>
              <div className="space-y-2">
                <Textarea placeholder="Type your reply..." value={reply} onChange={e => setReply(e.target.value)} className="min-h-[80px]" />
                <Button onClick={send} disabled={!reply.trim() || sending} className="gap-2 w-full">
                  <Send className="h-4 w-4" />{sending ? "Sending..." : "Send via Facebook"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageInbox;
