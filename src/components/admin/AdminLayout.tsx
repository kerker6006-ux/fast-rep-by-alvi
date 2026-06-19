import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Wallet, CreditCard, Megaphone, Globe, Settings as Cog,
  BarChart3, Tag, LogOut, Bot, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const items = [
  { to: "/admin", icon: LayoutDashboard, key: "admin.nav.overview", end: true },
  { to: "/admin/users", icon: Users, key: "admin.nav.users" },
  { to: "/admin/recharges", icon: Wallet, key: "admin.nav.recharges" },
  { to: "/admin/payments", icon: CreditCard, key: "admin.nav.payments" },
  { to: "/admin/pricing", icon: Tag, key: "admin.nav.pricing" },
  { to: "/admin/fb-pages", icon: Globe, key: "admin.nav.fbPages" },
  { to: "/admin/announcements", icon: Megaphone, key: "admin.nav.announcements" },
  { to: "/admin/analytics", icon: BarChart3, key: "admin.nav.analytics" },
  { to: "/admin/settings", icon: Cog, key: "admin.nav.settings" },
];

const AdminLayout = () => {
  const { signOut, user } = useAuth();
  const nav = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex w-full bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-800">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-base leading-none">LeadPilot</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{t("admin.console")}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-medium shadow-lg shadow-blue-600/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{t(key)}</span>
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="px-2 py-2 text-xs text-slate-400 truncate">{user?.email}</div>
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={async () => { await signOut(); nav("/admin/login"); }}
          >
            <LogOut className="h-4 w-4 mr-2" /> {t("common.signOut")}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
