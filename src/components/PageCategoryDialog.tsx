import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Briefcase, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageCategory } from "@/contexts/ActivePageContext";

const options: { value: PageCategory; label: string; desc: string; icon: any }[] = [
  { value: "ecommerce", label: "E-commerce", desc: "I sell physical or digital products", icon: ShoppingBag },
  { value: "service", label: "Service", desc: "Clinic, salon, home services, consulting", icon: Briefcase },
  { value: "content_creator", label: "Content Creator", desc: "I sell online courses to my audience", icon: Video },
];

type Props = {
  pageId: string | null;
  pageName?: string | null;
  onDone: () => void;
};

const PageCategoryDialog = ({ pageId, pageName, onDone }: Props) => {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<PageCategory | null>(null);

  const save = useMutation({
    mutationFn: async (cat: PageCategory) => {
      if (!pageId) throw new Error("No page");
      const { error } = await supabase
        .from("fb_pages")
        .update({ page_category: cat })
        .eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-pages"] });
      qc.invalidateQueries({ queryKey: ["fb-pages"] });
      toast.success("Page category saved");
      setPicked(null);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!pageId} onOpenChange={(v) => !v && onDone()}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>What does {pageName || "this page"} do?</DialogTitle>
          <DialogDescription>
            Choose once — this locks the workspace type. To change it later you'll have to disconnect and reconnect the page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {options.map((o) => {
            const Icon = o.icon;
            const isPicked = picked === o.value;
            return (
              <Card
                key={o.value}
                onClick={() => setPicked(o.value)}
                className={`p-4 cursor-pointer transition-all ${isPicked ? "border-primary shadow-glow ring-2 ring-primary/30" : "hover:border-primary/50"}`}
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="font-semibold text-sm">{o.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
              </Card>
            );
          })}
        </div>
        <Button
          disabled={!picked || save.isPending}
          onClick={() => picked && save.mutate(picked)}
          className="w-full mt-2"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm category"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PageCategoryDialog;
