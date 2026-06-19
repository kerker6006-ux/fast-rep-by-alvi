import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Mail, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const AdminSettings = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.settings.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.settings.subtitle")}</p>
      </header>

      <Card className="border-0 shadow-soft max-w-2xl">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold">{t("admin.settings.adminAccount")}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" /> {user?.email}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("settings.language")}</p>
            <LanguageSwitcher />
          </div>
          <Button variant="outline" onClick={async () => { await signOut(); nav("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> {t("common.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
