import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Wand2, MessageCircle, Lightbulb } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

const callFn = async (body: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-fb-page`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
};

const FbPageAiAnalyzer = () => {
  const queryClient = useQueryClient();
  const [analysis, setAnalysis] = useState<any>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");

  const analyzeMut = useMutation({
    mutationFn: () => callFn({ action: "analyze" }),
    onSuccess: (d) => {
      setAnalysis(d);
      toast.success(`Analyzed ${d.total_posts} posts from ${d.page_name}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chatMut = useMutation({
    mutationFn: (q: string) => callFn({ action: "chat", question: q, history: chat }),
    onSuccess: (d) => setChat(c => [...c, { role: "assistant", content: d.reply }]),
    onError: (e: Error) => {
      toast.error(e.message);
      setChat(c => c.slice(0, -1));
    },
  });

  const importMut = useMutation({
    mutationFn: () => callFn({ action: "auto_import" }),
    onSuccess: (d) => {
      toast.success(`Imported ${d.imported} of ${d.attempted} posts to Pending Review`);
      queryClient.invalidateQueries({ queryKey: ["pending-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendChat = () => {
    if (!input.trim()) return;
    setChat(c => [...c, { role: "user", content: input }]);
    chatMut.mutate(input);
    setInput("");
  };

  const askSuggested = (q: string) => {
    setChat(c => [...c, { role: "user", content: q }]);
    chatMut.mutate(q);
  };

  if (!analysis) {
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">AI Page Analyzer</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            AI আপনার পুরো Facebook page-এর সব post স্ক্যান করবে, analyze করবে, প্রশ্নের উত্তর দিবে এবং নিজে থেকেই product import করতে পারবে।
          </p>
        </div>
        <Button onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending} size="lg" className="gap-2">
          {analyzeMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning page...</> : <><Sparkles className="h-4 w-4" /> Analyze My Page</>}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Page Analysis</h3>
              <p className="text-xs text-muted-foreground">{analysis.page_name} • {analysis.total_posts} posts scanned</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}>
              {analyzeMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-scan"}
            </Button>
          </div>
          <p className="text-sm">{analysis.summary}</p>
          {analysis.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {analysis.categories.map((c: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {analysis.insights?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" /> Insights</h4>
            <ul className="space-y-1.5">
              {analysis.insights.map((ins: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span>{ins}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Auto-Import */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Auto-Import Recommended Products</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI {analysis.recommended_posts?.length || 0}টি product post detect করেছে। একসাথে import করুন।
            </p>
          </div>
          <Button onClick={() => importMut.mutate()} disabled={importMut.isPending} className="gap-1.5 shrink-0">
            {importMut.isPending ? <><Loader2 className="h-3 w-3 animate-spin" /> Importing...</> : <><Wand2 className="h-3 w-3" /> Import All</>}
          </Button>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Ask Anything About Your Page</h4>

          {chat.length === 0 && analysis.questions_user_might_ask?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Suggested questions:</p>
              {analysis.questions_user_might_ask.map((q: string, i: number) => (
                <button
                  key={i}
                  onClick={() => askSuggested(q)}
                  className="block w-full text-left text-xs p-2 rounded-md bg-muted hover:bg-muted/70 transition"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          )}

          {chat.length > 0 && (
            <ScrollArea className="h-64 border rounded-md p-3">
              <div className="space-y-3">
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatMut.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="যেমন: কোন product সবচেয়ে বেশি post করেছি?"
              disabled={chatMut.isPending}
            />
            <Button onClick={sendChat} disabled={chatMut.isPending || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FbPageAiAnalyzer;
