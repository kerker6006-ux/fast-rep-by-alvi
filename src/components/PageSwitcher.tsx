import { Facebook, ChevronDown, Check } from "lucide-react";
import { useActivePage, PageCategory } from "@/contexts/ActivePageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const categoryLabel: Record<PageCategory, string> = {
  ecommerce: "E-commerce",
  service: "Service",
  content_creator: "Creator",
};

const categoryColor: Record<PageCategory, string> = {
  ecommerce: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  service: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  content_creator: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400",
};

const PageSwitcher = () => {
  const { pages, activePage, setActivePageId } = useActivePage();
  const [open, setOpen] = useState(false);

  if (!pages.length) {
    return (
      <div className="text-xs text-muted-foreground italic">No pages connected</div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 max-w-[260px]">
          {activePage?.page_picture_url ? (
            <img src={activePage.page_picture_url} alt="" className="h-5 w-5 rounded-full object-cover" />
          ) : (
            <Facebook className="h-4 w-4 text-blue-600" />
          )}
          <span className="truncate text-sm font-medium">{activePage?.page_name || "Select page"}</span>
          {activePage?.page_category && (
            <Badge variant="secondary" className={`${categoryColor[activePage.page_category]} text-[10px] px-1.5 py-0`}>
              {categoryLabel[activePage.page_category]}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="end">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-2 py-1.5">Your pages</div>
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => { setActivePageId(p.id); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
          >
            {p.page_picture_url ? (
              <img src={p.page_picture_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Facebook className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.page_name || "Unnamed"}</p>
              {p.page_category && (
                <span className={`inline-block text-[10px] px-1.5 py-0 rounded ${categoryColor[p.page_category]}`}>
                  {categoryLabel[p.page_category]}
                </span>
              )}
              {!p.page_category && (
                <span className="text-[10px] text-amber-600">Category not set</span>
              )}
            </div>
            {p.id === activePage?.id && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default PageSwitcher;
