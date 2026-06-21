import { useState } from "react";
import { useTranslation } from "react-i18next";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Loader2, Sparkles, Zap, Globe } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.875 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.313 0 2.686.234 2.686.234v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.47h-2.796v8.384A12.003 12.003 0 0 0 24 12z"/>
  </svg>
);

const Auth = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Could not start Google sign-in");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    window.location.href = "/dashboard";
  };

  const handleFacebook = async () => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const redirectTo = `${window.location.origin}/dashboard`;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fb-login-start?redirect_to=${encodeURIComponent(redirectTo)}`,
      );
      const data = await res.json();
      if (!res.ok || !data?.url) {
        toast.error(data?.error ?? "Could not start Facebook sign-in");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-soft">
      <div className="absolute inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="absolute top-0 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-primary-glow/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: "5s" }} />

      <div className="absolute top-6 right-6 z-10">
        <LanguageSwitcher variant="floating" />
      </div>

      <div className="relative min-h-screen flex">
        <div className="hidden lg:flex flex-1 flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <span className="font-display text-xl font-bold">LeadPilot</span>
          </div>

          <div className="space-y-8 max-w-lg">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border shadow-soft text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>{t("auth.heroBadge")}</span>
              </div>
              <h1 className="font-display text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]">
                {t("auth.heroLine1")} <span className="text-gradient">{t("auth.heroLine2")}</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{t("auth.heroDesc")}</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Zap, label: t("auth.feature1") },
                { icon: Globe, label: t("auth.feature2") },
                { icon: Sparkles, label: t("auth.feature3") },
              ].map((f) => (
                <div key={f.label} className="rounded-2xl bg-card/60 backdrop-blur border border-border p-4 shadow-soft">
                  <f.icon className="h-5 w-5 text-primary mb-2" />
                  <p className="text-xs font-medium">{f.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t("auth.copyright")}</p>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="h-11 w-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="font-display text-xl font-bold">LeadPilot</span>
            </div>

            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-elevated">
              <div className="space-y-1.5 mb-6 text-center">
                <h2 className="font-display text-2xl font-bold tracking-tight">Welcome to LeadPilot</h2>
                <p className="text-sm text-muted-foreground">Sign in with Google or Facebook to continue.</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleGoogle}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-12 rounded-xl gap-3 bg-white text-slate-900 hover:bg-slate-50 border-slate-200 text-base font-medium"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                  Continue with Google
                </Button>

                <Button
                  onClick={handleFacebook}
                  disabled={loading}
                  className="w-full h-12 rounded-xl gap-3 bg-[#1877F2] text-white hover:bg-[#166FE5] border-0 text-base font-medium"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FacebookIcon />}
                  Continue with Facebook
                </Button>
              </div>

              <p className="mt-6 text-center text-[11px] text-muted-foreground">
                By continuing you agree to our terms and acknowledge our privacy practices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
