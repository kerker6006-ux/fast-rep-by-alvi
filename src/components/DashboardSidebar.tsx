import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  BarChart3, Package, ShoppingCart, MessageSquare,
  Zap, Clock, Settings, Bot, Brain, ChevronLeft, ChevronRight, LogOut, Globe, Activity, Coins, AlertTriangle, Inbox, Lightbulb, Briefcase, UserPlus, Megaphone,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useBusinessCategory } from "@/hooks/useBusinessCategory";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";




type NavItem = { id: string; labelKey: string; icon: React.ElementType; adminOnly?: boolean; show?: (cat: string | null | undefined) => boolean };

const isEcom = (c: any) => c === "ecommerce";
const isService = (c: any) => c && c !== "ecommerce";

const navItems: NavItem[] = [
  { id: "analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { id: "credits", labelKey: "nav.credits", icon: Coins },
  { id: "ai-usage", labelKey: "nav.aiUsage", icon: Activity },
  { id: "ai-training", labelKey: "nav.aiTraining", icon: Brain },
  { id: "products", labelKey: "nav.products", icon: Package, show: (c) => !c || isEcom(c) },
  { id: "services", labelKey: "nav.services", icon: Briefcase, show: (c) => isService(c) },
  { id: "leads", labelKey: "nav.leads", icon: UserPlus, show: () => true },
  { id: "pending-products", labelKey: "nav.autoImport", icon: Inbox, show: (c) => !c || isEcom(c) },
  { id: "suggestions", labelKey: "nav.suggestions", icon: Lightbulb, show: (c) => !c || isEcom(c) },
  { id: "website-import", labelKey: "nav.websiteImport", icon: Globe },
  { id: "orders", labelKey: "nav.orders", icon: ShoppingCart, show: (c) => !c || isEcom(c) },
  { id: "complaints", labelKey: "nav.complaints", icon: AlertTriangle },
  { id: "conversations", labelKey: "nav.chats", icon: MessageSquare },
  { id: "auto-reply", labelKey: "nav.autoReply", icon: Zap },
  { id: "comment-triggers", labelKey: "nav.commentTriggers", icon: Megaphone },
  { id: "scheduled", labelKey: "nav.scheduled", icon: Clock },
  { id: "fb-pages", labelKey: "nav.fbPages", icon: Globe },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const DashboardSidebar = ({ activeTab, onTabChange, collapsed, onCollapsedChange }: DashboardSidebarProps) => {
  const { t } = useTranslation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { category } = useBusinessCategory();
  const navigate = useNavigate();

  const { data: unreadAlerts = 0 } = useQuery({
    queryKey: ["sidebar-unread-alerts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("needs_human", true)
        .or("alert_seen_at.is.null,alert_seen_at.lt.last_message_at");
      return count || 0;
    },
    refetchInterval: 20000,
  });

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.show && !item.show(category)) return false;
    return true;
  });


  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r transition-all duration-300 ease-out",
        "bg-sidebar text-sidebar-foreground border-sidebar-border",
        collapsed ? "w-[72px]" : "w-[240px]",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
          <Bot className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <p className="font-display font-bold text-sm leading-tight truncate">LeadPilot</p>
            <p className="text-[11px] text-sidebar-foreground/60 leading-tight truncate">{t("app.tagline")}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const nicheLabel = (id: string, base: string) => {
            if (!isService(category)) return base;
            if (id === "leads") return "nav.appointments";
            if (id === "conversations") return `nav.chatsByCat.${category}`;
            if (id === "complaints") return `nav.complaintsByCat.${category}`;
            return base;
          };
          const labelKey = nicheLabel(item.id, item.labelKey);
          const isActive = activeTab === item.id;
          const button = (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "active:scale-[0.97]",
                isActive
                  ? "bg-gradient-primary text-white shadow-glow"
                  : "text-sidebar-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate animate-fade-in flex-1">{t(labelKey)}</span>}
              {item.id === "conversations" && unreadImages > 0 && (
                <Badge variant="destructive" className={cn("h-5 min-w-[20px] px-1.5 text-[10px] font-bold", collapsed && "absolute top-1 right-1")}>{unreadImages}</Badge>
              )}
            </button>
          );
          if (collapsed) {
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{t(labelKey)}</TooltipContent>
              </Tooltip>
            );
          }
          return button;
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-sidebar-border p-2 shrink-0 space-y-0.5">
        {!collapsed && user && (
          <div className="px-3 py-2 text-[11px] text-sidebar-foreground/50 truncate">{user.email}</div>
        )}
        <LanguageSwitcher collapsed={collapsed} />
        
        <button
          onClick={signOut}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>{t("nav.signOut")}</span>}
        </button>
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>{t("nav.collapse")}</span>}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
