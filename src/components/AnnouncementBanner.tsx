import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Megaphone } from "lucide-react";
import { useState } from "react";

const AnnouncementBanner = () => {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { data: announcements = [] } = useQuery({
    queryKey: ["user-announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    refetchInterval: 60000, // refresh every minute
  });

  const visible = announcements.filter((a: any) => !dismissed.includes(a.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a: any) => (
        <div key={a.id} className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{a.title}</p>
            {a.body && <p className="text-xs text-muted-foreground mt-0.5">{a.body}</p>}
          </div>
          <button
            onClick={() => setDismissed(prev => [...prev, a.id])}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;
