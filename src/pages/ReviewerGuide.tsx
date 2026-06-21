import { Link } from "react-router-dom";
import { ArrowLeft, Facebook, MessageSquare, MousePointerClick, ShieldCheck } from "lucide-react";

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="flex gap-4">
    <div className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">{n}</div>
    <div className="flex-1">
      <h3 className="font-semibold">{title}</h3>
      <div className="text-sm text-muted-foreground mt-1">{children}</div>
    </div>
  </li>
);

const Perm = ({ name, why }: { name: string; why: string }) => (
  <tr className="border-b border-border">
    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{name}</td>
    <td className="py-2 text-sm">{why}</td>
  </tr>
);

const ReviewerGuide = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to LeadPilot
        </Link>
        <span className="text-xs text-muted-foreground">For Meta App Reviewers</span>
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-8">
        <h1 className="text-3xl font-bold tracking-tight">Reviewer Guide</h1>
        <p className="text-muted-foreground mt-2">
          Step-by-step instructions for testing LeadPilot's Facebook integration.
        </p>
      </div>
    </header>

    <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <section>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Test credentials</h2>
        <div className="rounded-lg border border-border p-5 font-mono text-sm space-y-1 bg-muted/30">
          <div><span className="text-muted-foreground">URL: </span>https://leadpilot.life/auth</div>
          <div><span className="text-muted-foreground">Email: </span>leadpilot24@gmail.com</div>
          <div><span className="text-muted-foreground">Password: </span>MetaReview2026!</div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This account is dedicated to Meta reviewers. It has $50 in test credit and no real customers.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><MousePointerClick className="w-5 h-5" /> Test flow</h2>
        <ol className="space-y-5">
          <Step n={1} title="Sign in">
            Go to <code className="text-xs bg-muted px-1 py-0.5 rounded">https://leadpilot.life/auth</code> and log in with the credentials above.
          </Step>
          <Step n={2} title="Open Facebook Pages">
            In the left sidebar, click <strong>Facebook Pages</strong>.
          </Step>
          <Step n={3} title="Start the Facebook login flow">
            Click the blue <strong>Connect Facebook + Instagram</strong> button. You'll be redirected to Facebook's permission dialog.
          </Step>
          <Step n={4} title="Grant permissions">
            Approve all requested permissions (pages_show_list, pages_manage_metadata, pages_messaging, pages_read_engagement, pages_read_user_content, business_management).
          </Step>
          <Step n={5} title="Select a page">
            You'll see a list of pages you manage. Select any page, then click <strong>Connect Page</strong>.
          </Step>
          <Step n={6} title="Verify webhook subscription">
            The page now appears in the <strong>Connected Pages</strong> grid with an <strong>Active</strong> badge — this confirms LeadPilot successfully subscribed to messages, comments, and feed events.
          </Step>
          <Step n={7} title="Test auto-reply (pages_messaging)">
            From a different Facebook account, send a DM to the connected page (e.g. "What products do you sell?"). Within 5 seconds the bot replies with a Bangla shopkeeper message.
          </Step>
          <Step n={8} title="Test comment reply (pages_read_engagement / pages_read_user_content)">
            Comment "How much?" on any post on the connected page. The bot replies in the comment thread.
          </Step>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><Facebook className="w-5 h-5" /> Why we request each permission</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <tbody>
              <Perm name="pages_show_list" why="Display the user's pages in a picker so they choose which one LeadPilot manages." />
              <Perm name="pages_manage_metadata" why="Subscribe the selected page to messages, feed, and messaging_postbacks webhooks so the bot receives events." />
              <Perm name="pages_messaging" why="Send AI-generated replies to customer DMs on behalf of the merchant." />
              <Perm name="pages_read_engagement" why="Read post comments so the bot can auto-reply to customer questions on posts." />
              <Perm name="pages_read_user_content" why="Read comment text to detect orders/complaints and respond appropriately." />
              <Perm name="business_management" why="Required because LeadPilot is multi-tenant SaaS — each merchant is a separate business." />
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Data handling at a glance</h2>
        <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
          <li>All Platform data is encrypted at rest (database-level) and in transit (TLS 1.2+).</li>
          <li>Page access tokens are stored encrypted and never exposed to the client.</li>
          <li>Users can disconnect a page at any time — data is hidden immediately and permanently deleted after 7 days.</li>
          <li>Data deletion callback is implemented at our webhook endpoint and confirmation is visible at <Link className="underline" to="/data-deletion-status">/data-deletion-status</Link>.</li>
          <li>Full policy: <Link className="underline" to="/privacy">Privacy</Link> · <Link className="underline" to="/terms">Terms</Link> · <Link className="underline" to="/data-deletion">Data Deletion Instructions</Link>.</li>
        </ul>
      </section>
    </main>
  </div>
);

export default ReviewerGuide;
