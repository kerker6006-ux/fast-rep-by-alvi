import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

const AdminPayments = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.payments.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.payments.subtitle")}</p>
      </header>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-10 text-center">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
            <CreditCard className="h-8 w-8 text-white" />
          </div>
          <h3 className="font-display text-xl font-bold">{t("admin.payments.stripeTitle")}</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">{t("admin.payments.stripeDesc")}</p>
          <Button className="mt-6" size="lg">
            {t("admin.payments.connect")} <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-xs text-slate-400 mt-4">{t("admin.payments.willEnableLater")}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPayments;
