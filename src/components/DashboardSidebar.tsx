import { cn } from "@/lib/utils";
import {
  BarChart3, Package, ShoppingCart, MessageSquare,
  Zap, Clock, Settings, Bot, Brain, ChevronLeft, ChevronRight
} from "lucide-react";
import { useState } from "react";

type NavItem = {
  id: string;
  label: string;
  labelBn: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  { id: "analytics", label: "Analytics", labelBn: "বিশ্লেষণ", icon: BarChart3 },
  { id: "ai-training", label: "AI Training", labelBn: "AI ট্রেনিং", icon: Brain },
  { id: "products", label: "Products", labelBn: "পণ্য", icon: Package },
  { id: "orders", label: "Orders", labelBn: "অর্ডার", icon: ShoppingCart },
  { id: "conversations", label: "Chats", labelBn: "চ্যাট", icon: MessageSquare },
  { id: "auto-reply", label: "Auto-Reply", labelBn: "অটো-রিপ্লাই", icon: Zap },
  { id: "scheduled", label: "Scheduled", labelBn: "নির্ধারিত", icon: Clock },
  { id: "settings", label: "Settings", labelBn: "সেটিংস", icon: Settings },
];

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DashboardSidebar = ({ activeTab, onTabChange }: DashboardSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r transition-all duration-300 ease-out",
        "bg-sidebar text-sidebar-foreground border-sidebar-border",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <p className="font-semibold text-sm text-sidebar-primary-foreground leading-tight truncate">
              FB Auto Bot
            </p>
            <p className="text-[11px] text-sidebar-foreground/60 leading-tight truncate">
              AI Messenger Bot
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "active:scale-[0.97]",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/30"
                  : "text-sidebar-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <span className="truncate animate-fade-in">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
