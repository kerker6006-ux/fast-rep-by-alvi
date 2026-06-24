import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "success"; pageName?: string; role?: string; createdNewUser?: boolean; email?: string }
  | { kind: "error"; message: string };

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Missing invite token." });
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("accept-page-invite", { body: { token } });
      if (error) {
        setState({ kind: "error", message: error.message || "Failed to accept invite." });
        return;
      }
      if (data?.error) {
        setState({ kind: "error", message: data.error });
        return;
      }
      setState({
        kind: "success",
        pageName: data?.page_name,
        role: data?.role,
        createdNewUser: !!data?.created_new_user,
        email: data?.email,
      });
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-5 rounded-2xl shadow-elevated">
        {state.kind === "loading" && (
          <>
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <h1 className="text-xl font-display font-bold">Accepting your invite…</h1>
          </>
        )}
        {state.kind === "success" && (
          <>
            <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
            <h1 className="text-2xl font-display font-bold">You're in! 🎉</h1>
            <p className="text-muted-foreground text-sm">
              You now have <strong>{state.role === "full" ? "Full Access" : "Moderator"}</strong> access to
              {" "}<strong>{state.pageName || "the page"}</strong>.
            </p>
            {state.createdNewUser ? (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-left text-sm text-blue-900 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" /> Check your inbox
                </div>
                <p>
                  We just emailed <strong>{state.email}</strong> a link to set your password.
                  Once you set it, sign in to start managing the page.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sign in (or refresh) to see the shared page in your dashboard.</p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => navigate("/dashboard")} className="rounded-xl">Go to dashboard</Button>
              <Link to="/auth" className="text-xs text-muted-foreground underline">Or sign in with a different account</Link>
            </div>
          </>
        )}
        {state.kind === "error" && (
          <>
            <XCircle className="h-14 w-14 mx-auto text-destructive" />
            <h1 className="text-2xl font-display font-bold">Invite unavailable</h1>
            <p className="text-muted-foreground text-sm">{state.message}</p>
            <Button variant="outline" onClick={() => navigate("/")}>Back home</Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default AcceptInvite;
