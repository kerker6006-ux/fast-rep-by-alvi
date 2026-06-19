import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AdminLogin = () => {
  const nav = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // If already signed in as admin, jump to /admin
  useEffect(() => {
    if (!authLoading && !adminLoading && session && isAdmin) {
      nav("/admin", { replace: true });
    }
  }, [session, isAdmin, authLoading, adminLoading, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Sign out any existing (non-admin) session first to keep panel isolated
      if (session) await supabase.auth.signOut();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // Verify admin role
      const uid = data.user?.id;
      if (!uid) throw new Error("No user");
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();

      if (!roles) {
        await supabase.auth.signOut();
        throw new Error("This account is not an administrator.");
      }

      toast.success("Welcome, Administrator");
      nav("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.18),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-2xl shadow-blue-600/40 mb-4">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin Console</h1>
          <p className="text-sm text-slate-400 mt-2">
            Restricted area — authorized personnel only
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-2xl p-7 shadow-2xl space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="text-slate-300 text-xs uppercase tracking-wider">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="username"
                className="pl-9 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-pw" className="text-slate-300 text-xs uppercase tracking-wider">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="admin-pw"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="pl-9 pr-10 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-11 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-semibold shadow-lg shadow-blue-600/30"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" /> Enter Admin Console
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-slate-500 pt-2">
            This portal is monitored. Unauthorized access attempts are logged.
          </p>
        </form>

        <div className="text-center mt-6">
          <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to main site
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
