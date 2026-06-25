import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";

type Status = "pending" | "processing" | "completed" | "failed";

const DataDeletionStatus = () => {
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) { setLoading(false); setNotFound(true); return; }
    (async () => {
      const { data } = await supabase.rpc("get_data_deletion_status", { _code: code });
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) setNotFound(true);
      else {
        setStatus(row.status as Status);
        setCreatedAt(row.created_at);
        setCompletedAt(row.completed_at);
      }
      setLoading(false);
    })();
  }, [code]);

  const Icon =
    status === "completed" ? CheckCircle2 :
    status === "failed" ? XCircle :
    Clock;
  const tone =
    status === "completed" ? "text-emerald-600" :
    status === "failed" ? "text-destructive" :
    "text-amber-600";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to LeadPilot
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Data deletion request</h1>
        <p className="text-muted-foreground mb-8">
          Status of your Facebook data deletion request with LeadPilot.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Looking up your request…
          </div>
        ) : notFound ? (
          <div className="rounded-lg border border-border p-6">
            <p className="font-medium">No request found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              The confirmation code is missing or invalid. If you submitted a deletion through Facebook,
              please retry from Facebook Settings → Apps and Websites.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Icon className={`w-7 h-7 ${tone}`} />
              <div>
                <p className="font-semibold capitalize">{status}</p>
                <p className="text-xs text-muted-foreground font-mono">Code: {code}</p>
              </div>
            </div>
            <dl className="text-sm grid grid-cols-[120px_1fr] gap-y-1">
              {createdAt && (<><dt className="text-muted-foreground">Requested</dt><dd>{new Date(createdAt).toLocaleString()}</dd></>)}
              {completedAt && (<><dt className="text-muted-foreground">Completed</dt><dd>{new Date(completedAt).toLocaleString()}</dd></>)}
            </dl>
            <p className="text-sm text-muted-foreground border-t border-border pt-4">
              {status === "completed"
                ? "All Facebook data associated with your account has been removed from LeadPilot."
                : status === "failed"
                ? "We could not complete the deletion automatically. Email leadpilot24@gmail.com and we'll process it manually within 30 days."
                : "Your request is being processed. This usually completes within a few minutes."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default DataDeletionStatus;
