import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "validating" | "valid" | "invalid" | "already" | "loading" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("validating");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setState("invalid"); setError(data?.error ?? ""); return; }
        if (data?.alreadyUnsubscribed) { setState("already"); setEmail(data.email ?? null); return; }
        setEmail(data?.email ?? null);
        setState("valid");
      } catch (e) {
        setState("invalid");
        setError((e as Error).message);
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("loading");
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    if (error) { setState("error"); setError(error.message); return; }
    setState("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-3xl shadow-elevated p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <MailX className="h-6 w-6" />
        </div>
        {state === "validating" && (<><h1 className="font-display text-xl font-bold">Checking link…</h1><Loader2 className="h-5 w-5 animate-spin mx-auto mt-4" /></>)}
        {state === "valid" && (
          <>
            <h1 className="font-display text-xl font-bold mb-2">Unsubscribe from LeadPilot emails</h1>
            <p className="text-sm text-muted-foreground mb-6">{email ? <>You'll stop receiving emails at <strong>{email}</strong>.</> : "Confirm to stop receiving emails."}</p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}
        {state === "loading" && (<><h1 className="font-display text-xl font-bold">Unsubscribing…</h1><Loader2 className="h-5 w-5 animate-spin mx-auto mt-4" /></>)}
        {state === "done" && (<><CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" /><h1 className="font-display text-xl font-bold">You're unsubscribed</h1><p className="text-sm text-muted-foreground mt-2">{email ?? "This address"} won't receive further emails.</p></>)}
        {state === "already" && (<><CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" /><h1 className="font-display text-xl font-bold">Already unsubscribed</h1><p className="text-sm text-muted-foreground mt-2">{email ?? "This address"} is already opted out.</p></>)}
        {(state === "invalid" || state === "error") && (<><XCircle className="h-10 w-10 text-destructive mx-auto mb-2" /><h1 className="font-display text-xl font-bold">Invalid or expired link</h1><p className="text-sm text-muted-foreground mt-2">{error || "Please use the unsubscribe link from a recent email."}</p></>)}
      </div>
    </div>
  );
};

export default Unsubscribe;
