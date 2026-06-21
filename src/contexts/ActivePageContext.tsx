import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PageCategory = "ecommerce" | "service" | "content_creator";

export type ActivePage = {
  id: string;
  fb_page_id: string;
  page_name: string | null;
  page_picture_url: string | null;
  page_category: PageCategory | null;
  is_active: boolean;
  pending_delete_at: string | null;
};

type Ctx = {
  pages: ActivePage[];
  activePage: ActivePage | null;
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;
  isLoading: boolean;
  refetch: () => void;
};

const ActivePageContext = createContext<Ctx>({
  pages: [],
  activePage: null,
  activePageId: null,
  setActivePageId: () => {},
  isLoading: true,
  refetch: () => {},
});

export const useActivePage = () => useContext(ActivePageContext);

const STORAGE_KEY = "lp:active_page_id";

export const ActivePageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [activePageId, setActivePageIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null),
  );

  const { data: pages = [], isLoading, refetch } = useQuery({
    queryKey: ["active-pages", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fb_pages")
        .select("id, fb_page_id, page_name, page_picture_url, page_category, is_active, pending_delete_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter((p: any) =>
        p.is_active && (!p.pending_delete_at || new Date(p.pending_delete_at).getTime() > now),
      ) as ActivePage[];
    },
    refetchInterval: 30_000,
  });

  // Auto-pick first page if none selected or selected is gone
  useEffect(() => {
    if (!pages.length) return;
    if (!activePageId || !pages.find((p) => p.id === activePageId)) {
      const first = pages[0].id;
      setActivePageIdState(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
  }, [pages, activePageId]);

  const setActivePageId = (id: string | null) => {
    setActivePageIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const activePage = useMemo(() => pages.find((p) => p.id === activePageId) ?? null, [pages, activePageId]);

  return (
    <ActivePageContext.Provider value={{ pages, activePage, activePageId, setActivePageId, isLoading, refetch }}>
      {children}
    </ActivePageContext.Provider>
  );
};
