import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Stethoscope, Wrench, Sparkles } from "lucide-react";
import { BUSINESS_CATEGORIES, BusinessCategory, useBusinessCategory } from "@/hooks/useBusinessCategory";
import { toast } from "sonner";

const ICONS: Record<BusinessCategory, React.ElementType> = {
  ecommerce: ShoppingBag,
  dental: Stethoscope,
  hvac: Wrench,
  salon: Sparkles,
};

const CategoryOnboarding = () => {
  const { t } = useTranslation();
  const { category, isLoading, setCategory } = useBusinessCategory();

  const open = !isLoading && !category;

  const pick = async (c: BusinessCategory) => {
    try {
      await setCategory.mutateAsync(c);
      toast.success(t("onboarding.saved"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("onboarding.title")}</DialogTitle>
          <DialogDescription>{t("onboarding.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {BUSINESS_CATEGORIES.map((c) => {
            const Icon = ICONS[c];
            return (
              <Card
                key={c}
                onClick={() => pick(c)}
                className="p-5 cursor-pointer hover:border-primary hover:shadow-glow transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">{t(`category.${c}.name`)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t(`category.${c}.desc`)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryOnboarding;
