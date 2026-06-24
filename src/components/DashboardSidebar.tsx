import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  BarChart3, Package, ShoppingCart, MessageSquare,
  Zap, Clock, Settings, Brain, ChevronLeft, ChevronRight, LogOut, Globe, Activity, Coins,
  AlertTriangle, Inbox, Lightbulb, Briefcase, UserPlus, Megaphone, GraduationCap, Users,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import logoAsset from "@/assets/logo.png.asset.json";

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  // Categories that should see this item; undefined = always (and when no page connected)
  categories?: Array<"ecommerce" | "service" | "content_creator" | "none">;
};

// Common items shown to every category
const accountWide: NavItem[] = [
  { id: "analytics",  label: "Overview",  icon: BarChart3 },
  { id: "credits",    label: "Credits",   icon: Coins },
  { id: "ai-usage",   label: "AI Usage",  icon: Activity },
];

const perPage: NavItem[] = [
  { id: "ai-training",      label: "AI Training",       icon: Brain },
  // Ecommerce
  { id: "products",         label: "Products",          icon: Package,        categories: ["ecommerce"] },
  { id: "pending-products", label: "Auto Import",       icon: Inbox,          categories: ["ecommerce"] },
  { id: "suggestions",      label: "Suggestions",       icon: Lightbulb,      categories: ["ecommerce"] },
  { id: "orders",           label: "Orders",            icon: ShoppingCart,   categories: ["ecommerce"] },
  // Service
  { id: "services",         label: "Services",          icon: Briefcase,      categories: ["service"] },
  { id: "leads",            label: "Appointments",      icon: UserPlus,       categories: ["service"] },
  { id: "complaints",       label: "Callbacks",         icon: AlertTriangle,  categories: ["service"] },
  // Content creator
  { id: "courses",          label: "Courses",           icon: GraduationCap,  categories: ["content_creator"] },
  { id: "enrollments",      label: "Enrollments",       icon: Users,          categories: ["content_creator"] },
  // Shared (all categories)
  { id: "conversations",    label: "Inbox",             icon: MessageSquare },
  { id: "auto-reply",       label: "Auto-Reply",        icon: Zap },
  { id: "comment-triggers", label: "Comment Triggers",  icon: Megaphone },
  { id: "scheduled",        label: "Scheduled",         icon: Clock },
  { id: "website-import",   label: "Website Import",    icon: Globe },
  { id: "settings",         label: "Bot Settings",      icon: Settings },
];

const connection: NavItem[] = [
  { id: "fb-pages", label: "Connected Pages", icon: Globe },
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
  const { activePage, accessRole } = useActivePage();
  const category = activePage?.page_category;
  const isModerator = accessRole === "moderator";

  // Moderator can only see these tabs
  const moderatorAllowed = new Set(["conversations", "orders", "leads", "complaints"]);

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

  const filterByCat = (item: NavItem) => {
    if (isModerator && !moderatorAllowed.has(item.id)) return false;
    if (!item.categories) return true;
    if (!category) return false;
    return item.categories.includes(category as any);
  };

  const renderGroup = (items: NavItem[], items_filter = true) => {
    const visible = items_filter ? items.filter(filterByCat) : items;
    return visible.map((item) => {
      const isActive = activeTab === item.id;
      const button = (
        <button
          key={item.id}
          onClick={() => onTabChange(item.id)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.97]",
            isActive ? "bg-gradient-primary text-white shadow-glow" : "text-sidebar-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="truncate animate-fade-in flex-1 text-left">{item.label}</span>}
          {item.id === "conversations" && unreadAlerts > 0 && (
            <Badge variant="destructive" className={cn("h-5 min-w-[20px] px-1.5 text-[10px] font-bold", collapsed && "absolute top-1 right-1")}>{unreadAlerts}</Badge>
          )}
        </button>
      );
      if (collapsed) {
        return (
          <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
          </Tooltip>
        );
      }
      return button;
    });
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r transition-all duration-300 ease-out",
        "bg-sidebar text-sidebar-foreground border-sidebar-border",
        collapsed ? "w-[72px]" : "w-[240px]",
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-soft overflow-hidden">
          <img src={logoAsset.url} alt="LeadPilot logo" className="h-6 w-6 object-contain" width={36} height={36} />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <p className="font-display font-bold text-sm leading-tight truncate">LeadPilot</p>
            <p className="text-[11px] text-sidebar-foreground/60 leading-tight truncate">{t("app.tagline")}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-3 overflow-y-auto">
        <div className="space-y-0.5">
          {!collapsed && <div className="px-3 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 mb-1">Account</div>}
          {renderGroup(accountWide, false)}
        </div>

        {activePage && (
          <div className="space-y-0.5">
            {!collapsed && (
              <div className="px-3 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 mb-1 truncate">
                {activePage.page_name || "Page"}
              </div>
            )}
            {renderGroup(perPage)}
          </div>
        )}

        <div className="space-y-0.5">
          {!collapsed && <div className="px-3 text-[10px] uppercase tracking-wider text-sidebar-foreground/40 mb-1">Connections</div>}
          {renderGroup(connection, false)}


        </div>
      </nav>

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
