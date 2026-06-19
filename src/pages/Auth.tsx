import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bot, Mail, Lock, User, ArrowRight, Loader2, Sparkles, Zap, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Auth = () => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else {
        toast.success(t("auth.welcomeBack"));
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) toast.error(error.message);
      else {
        toast.success(t("auth.accountCreated"));
        navigate("/");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-soft">
      {/* Mesh background */}
      <div className="absolute inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="absolute top-0 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-0 -right-32 w-96 h-96 bg-primary-glow/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: "5s" }} />

      {/* Language switcher */}
      <div className="absolute top-6 right-6 z-10">
        <LanguageSwitcher variant="floating" />
      </div>

      <div className="relative min-h-screen flex">
        {/* Left side — branding (hidden on mobile) */}
        <div className="hidden lg:flex flex-1 flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <span className="font-display text-xl font-bold">Fast Rep</span>
          </div>

          <div className="space-y-8 max-w-lg">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border shadow-soft text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>{t("auth.heroBadge")}</span>
              </div>
              <h1 className="font-display text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]">
                {t("auth.heroLine1")}{" "}
                <span className="text-gradient">{t("auth.heroLine2")}</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("auth.heroDesc")}
              </p>
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

        {/* Right side — form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="h-11 w-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="font-display text-xl font-bold">Fast Rep</span>
            </div>

            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-elevated">
              <div className="space-y-1.5 mb-6">
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  {isLogin ? t("auth.signInTitle") : t("auth.signUpTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isLogin ? t("auth.signInSubtitle") : t("auth.signUpSubtitle")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-medium">{t("auth.displayName")}</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-10 h-11 rounded-xl" required />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">{t("auth.email")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 h-11 rounded-xl" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">{t("auth.password")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-11 rounded-xl" minLength={6} required />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 rounded-xl gap-2 bg-gradient-primary hover:opacity-95 shadow-glow text-base font-medium" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isLogin ? t("auth.signInBtn") : t("auth.signUpBtn")}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">{isLogin ? t("auth.noAccount") : t("auth.haveAccount")}</span>{" "}
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary font-semibold hover:underline">
                  {isLogin ? t("auth.signUp") : t("auth.signIn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
