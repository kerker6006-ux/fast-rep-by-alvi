import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Briefcase, Camera, MoreHorizontal, Sparkles } from "lucide-react";
import { COUNTRIES } from "@/data/countries";

type UserType = "business" | "creator" | "other";

const Welcome = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState<UserType>("business");
  const [country, setCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    // Prefill from auth metadata
    const meta = (user.user_metadata ?? {}) as Record<string, string>;
    setFullName((prev) => prev || meta.full_name || meta.name || "");
    // Check if already onboarded
    supabase
      .from("profiles")
      .select("onboarded_at, full_name, user_type, country")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarded_at) {
          navigate("/dashboard", { replace: true });
          return;
        }
        if (data?.full_name) setFullName(data.full_name);
        if (data?.user_type) setUserType(data.user_type as UserType);
        if (data?.country) setCountry(data.country);
      });
  }, [user, loading, navigate]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [countrySearch]);

  const submit = async () => {
    if (!user) return;
    if (!fullName.trim()) return toast.error("Please enter your name");
    if (!country) return toast.error("Please select your country");

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        display_name: fullName.trim(),
        user_type: userType,
        country,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    try { localStorage.setItem(`lp:onboarded:${user.id}`, "1"); } catch (_) { /* ignore */ }
    toast.success("Welcome to LeadPilot!");
    navigate("/dashboard", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh pointer-events-none" />
      <div className="relative max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border shadow-soft text-xs font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Just a few quick questions</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Welcome to <span className="text-gradient">LeadPilot</span>
          </h1>
          <p className="text-muted-foreground mt-2">Tell us a bit about you so we can personalize your experience.</p>
        </div>

        <Card className="p-6 md:p-8 shadow-elevated border-0 bg-card/80 backdrop-blur-xl space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">Your full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alvi Rahman"
              maxLength={100}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">What do you do?</Label>
            <RadioGroup value={userType} onValueChange={(v) => setUserType(v as UserType)} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: "business", label: "Business owner", desc: "I sell products or services", icon: Briefcase },
                { value: "creator", label: "Content creator", desc: "I build an audience online", icon: Camera },
                { value: "other", label: "Other", desc: "Something else", icon: MoreHorizontal },
              ].map((opt) => {
                const Icon = opt.icon;
                const selected = userType === opt.value;
                return (
                  <label
                    key={opt.value}
                    htmlFor={`ut-${opt.value}`}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${selected ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40"}`}
                  >
                    <RadioGroupItem id={`ut-${opt.value}`} value={opt.value} className="sr-only" />
                    <Icon className={`h-5 w-5 mb-2 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Which country are you from?</Label>
            <Input
              placeholder="Search country…"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background/60">
              {filteredCountries.map((c) => {
                const selected = country === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCountry(c.code)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${selected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                );
              })}
              {filteredCountries.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No countries match "{countrySearch}"</p>
              )}
            </div>
          </div>

          <Button className="w-full h-12 text-base" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to dashboard"}
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Welcome;
