import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PageCategory = "ecommerce" | "service" | "content_creator";
export type AccessRole = "owner" | "full" | "moderator";

export type ActivePage = {
  id: string;
  fb_page_id: string;
  page_name: string | null;
  page_picture_url: string | null;
  page_category: PageCategory | null;
  is_active: boolean;
  pending_delete_at: string | null;
  access_role: AccessRole;
};

type Ctx = {
  pages: ActivePage[];
  activePage: ActivePage | null;
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;
  isLoading: boolean;
  refetch: () => void;
  accessRole: AccessRole | null;
};

const ActivePageContext = createContext<Ctx>({
  pages: [],
  activePage: null,
  activePageId: null,
  setActivePageId: () => {},
  isLoading: true,
  refetch: () => {},
  accessRole: null,
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
      // owned pages
      const ownedReq = supabase
        .from("fb_pages")
        .select("id, fb_page_id, page_name, page_picture_url, page_category, is_active, pending_delete_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      // shared pages via page_members
      const sharedReq = supabase
        .from("page_members")
        .select("role, page:fb_pages_safe(id, fb_page_id, page_name, page_picture_url, page_category, is_active, pending_delete_at)")
        .eq("user_id", user!.id);

      const [{ data: owned, error: oErr }, { data: shared, error: sErr }] = await Promise.all([ownedReq, sharedReq]);
      if (oErr) throw oErr;
      if (sErr) throw sErr;

      const now = Date.now();
      const ownedList: ActivePage[] = (owned ?? [])
        .filter((p: any) => p.is_active && (!p.pending_delete_at || new Date(p.pending_delete_at).getTime() > now))
        .map((p: any) => ({ ...p, access_role: "owner" as AccessRole }));

      const sharedList: ActivePage[] = (shared ?? [])
        .filter((m: any) => m.page && m.page.is_active && (!m.page.pending_delete_at || new Date(m.page.pending_delete_at).getTime() > now))
        .map((m: any) => ({ ...m.page, access_role: m.role as AccessRole }));

      // de-dup (in case owner also has membership row by mistake)
      const seen = new Set<string>();
      return [...ownedList, ...sharedList].filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    },
    refetchInterval: 30_000,
  });

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
  const accessRole = activePage?.access_role ?? null;

  return (
    <ActivePageContext.Provider value={{ pages, activePage, activePageId, setActivePageId, isLoading, refetch, accessRole }}>
      {children}
    </ActivePageContext.Provider>
  );
};
