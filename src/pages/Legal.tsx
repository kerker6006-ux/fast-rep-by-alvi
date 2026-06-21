import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Trash2,
  Mail,
  Lock,
  Database,
  Users,
  Globe,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { ReactNode } from "react";

/* ---------- shared building blocks ---------- */

type Doc = "privacy" | "terms" | "deletion";

const DOC_META: Record<
  Doc,
  { title: string; subtitle: string; icon: typeof ShieldCheck; updated: string }
> = {
  privacy: {
    title: "Privacy Policy",
    subtitle:
      "How LeadPilot collects, uses, stores, and protects your data — written in plain language.",
    icon: ShieldCheck,
    updated: "June 21, 2026",
  },
  terms: {
    title: "Terms of Service",
    subtitle:
      "The rules that govern your use of LeadPilot. By using the service you agree to them.",
    icon: FileText,
    updated: "June 21, 2026",
  },
  deletion: {
    title: "Data Deletion",
    subtitle:
      "Three clear ways to delete your data from LeadPilot — for account holders and Facebook users.",
    icon: Trash2,
    updated: "June 21, 2026",
  },
};

const NAV_DOCS: { key: Doc; href: string; label: string }[] = [
  { key: "privacy", href: "/privacy", label: "Privacy" },
  { key: "terms", href: "/terms", label: "Terms" },
  { key: "deletion", href: "/data-deletion", label: "Data Deletion" },
];

function Shell({
  doc,
  toc,
  children,
}: {
  doc: Doc;
  toc: { id: string; label: string }[];
  children: ReactNode;
}) {
  const meta = DOC_META[doc];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">LeadPilot</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV_DOCS.map((d) => {
              const active = d.key === doc;
              return (
                <Link
                  key={d.key}
                  to={d.href}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    active
                      ? "bg-primary-soft text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {d.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{ background: "var(--gradient-mesh)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-14 md:py-20">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border/60 text-xs font-medium text-accent-foreground shadow-[var(--shadow-soft)]">
              <Icon className="w-3.5 h-3.5" />
              Legal &amp; Trust
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              Last updated {meta.updated}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl">
            {meta.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
            {meta.subtitle}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            Questions?{" "}
            <a
              href="mailto:leadpilot24@gmail.com"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              leadpilot24@gmail.com
            </a>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        {/* TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              On this page
            </p>
            <ul className="space-y-1 text-sm">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">{children}</main>
      </div>

      {/* Footer card */}
      <footer className="border-t border-border/60 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-soft)] flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-lg font-semibold">Need to talk to a human?</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                We respond to every email within one business day — complaints,
                deletion requests, security reports, billing questions, anything.
              </p>
            </div>
            <a
              href="mailto:leadpilot24@gmail.com"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium shadow-[var(--shadow-glow)] hover:opacity-95 transition-opacity"
            >
              <Mail className="w-4 h-4" />
              leadpilot24@gmail.com
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/data-deletion" className="hover:text-foreground">Data Deletion</Link>
            <span className="ml-auto">© {new Date().getFullYear()} LeadPilot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  n: number;
  title: string;
  icon?: typeof ShieldCheck;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-soft text-accent-foreground flex items-center justify-center font-semibold">
          {Icon ? <Icon className="w-5 h-5" /> : <span>{n}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Section {String(n).padStart(2, "0")}
          </p>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight mt-0.5">
            {title}
          </h2>
        </div>
      </div>
      <div className="prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-foreground/80 prose-li:my-1 prose-li:text-foreground/80 prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
        {children}
      </div>
    </section>
  );
}

function Callout({
  tone = "info",
  icon: Icon,
  title,
  children,
}: {
  tone?: "info" | "success" | "warn";
  icon?: typeof ShieldCheck;
  title?: string;
  children: ReactNode;
}) {
  const toneClasses =
    tone === "success"
      ? "border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.06)]"
      : tone === "warn"
      ? "border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)]"
      : "border-primary/20 bg-primary-soft";
  const ToneIcon =
    Icon ??
    (tone === "success" ? CheckCircle2 : tone === "warn" ? AlertCircle : ShieldCheck);
  return (
    <div className={`not-prose rounded-xl border p-4 flex gap-3 ${toneClasses}`}>
      <ToneIcon className="w-5 h-5 mt-0.5 shrink-0 text-accent-foreground" />
      <div className="text-sm">
        {title && <p className="font-semibold mb-1 text-foreground">{title}</p>}
        <div className="text-foreground/80 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Privacy ---------- */

const PRIVACY_TOC = [
  { id: "applies", label: "1. Who this applies to" },
  { id: "collect", label: "2. What we collect" },
  { id: "use", label: "3. How we use it" },
  { id: "share", label: "4. Sharing" },
  { id: "retain", label: "5. Retention" },
  { id: "rights", label: "6. Your rights" },
  { id: "security", label: "7. Security" },
  { id: "children", label: "8. Children" },
  { id: "changes", label: "9. Changes" },
  { id: "contact", label: "10. Contact" },
];

export const Privacy = () => (
  <Shell doc="privacy" toc={PRIVACY_TOC}>
    <Callout tone="info" icon={ShieldCheck} title="The short version">
      We only collect what we need to run the service. We never sell your data.
      We never use Facebook data for advertising. You can export or delete
      everything at any time.
    </Callout>

    <Section id="applies" n={1} title="Who this policy applies to" icon={Users}>
      <p>This policy applies to two groups of people:</p>
      <ul>
        <li>
          <strong>Account holders</strong> — people who sign up for LeadPilot
          and connect a Facebook Page.
        </li>
        <li>
          <strong>Page visitors</strong> — people who send messages or comments
          to a Facebook Page that uses LeadPilot.
        </li>
      </ul>
    </Section>

    <Section id="collect" n={2} title="Information we collect" icon={Database}>
      <p className="font-semibold !text-foreground">From account holders:</p>
      <ul>
        <li>Name, email, and profile picture from Google or email sign-up.</li>
        <li>
          Facebook user ID, name, profile picture, list of Pages you manage,
          and a Page access token (with the permissions you grant).
        </li>
        <li>
          Billing information — processed by Stripe. We never see card numbers.
        </li>
        <li>
          Your training data: product catalog, FAQs, business category, bot
          persona settings.
        </li>
      </ul>
      <p className="font-semibold !text-foreground mt-4">
        From page visitors (collected on behalf of the account holder):
      </p>
      <ul>
        <li>Facebook user ID and public name so the bot can address them.</li>
        <li>Messages, comments, and images sent to the connected Page.</li>
        <li>
          Any contact details (name, phone, address) the visitor voluntarily
          shares while placing an order.
        </li>
      </ul>
    </Section>

    <Section id="use" n={3} title="How we use the information" icon={CheckCircle2}>
      <ul>
        <li>
          Deliver replies, generate orders, and run the AI assistant for the
          connected Page.
        </li>
        <li>
          Bill the account holder for AI usage (per-message and per-image
          charges).
        </li>
        <li>Prevent abuse, debug errors, and improve the service.</li>
        <li>
          Send transactional emails (login, billing receipts, low balance
          alerts).
        </li>
      </ul>
      <Callout tone="success" title="We never">
        Sell personal data. Use Facebook user data for advertising. Share your
        business data with other customers.
      </Callout>
    </Section>

    <Section id="share" n={4} title="Sharing with third parties" icon={Globe}>
      <p>We use these subprocessors strictly to operate the service:</p>
      <ul>
        <li>
          <strong>Supabase / Lovable Cloud</strong> — database, authentication,
          edge functions.
        </li>
        <li>
          <strong>Google Gemini &amp; OpenRouter</strong> — to generate AI
          replies. Messages may be sent to these providers for inference.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing.
        </li>
        <li>
          <strong>Meta (Facebook)</strong> — read and send messages on the
          connected Page via the Graph API.
        </li>
      </ul>
    </Section>

    <Section id="retain" n={5} title="Data retention" icon={Calendar}>
      <ul>
        <li>
          Conversation history is kept while your account is active so the bot
          can maintain context. You can delete individual conversations anytime.
        </li>
        <li>
          If you disconnect a Facebook Page, the Page access token is revoked
          and removed.
        </li>
        <li>
          If you delete your account, all your data is permanently removed
          within 30 days.
        </li>
      </ul>
    </Section>

    <Section id="rights" n={6} title="Your rights" icon={ShieldCheck}>
      <p>
        You can access, export, or delete your data at any time from the
        dashboard, or by emailing{" "}
        <a href="mailto:leadpilot24@gmail.com">leadpilot24@gmail.com</a>.
        Facebook users whose messages were processed can request deletion via
        the same email or via the{" "}
        <Link to="/data-deletion">Data Deletion</Link> page.
      </p>
    </Section>

    <Section id="security" n={7} title="Security" icon={Lock}>
      <p>
        Data is encrypted in transit (HTTPS / TLS 1.2+) and at rest. Access
        tokens are stored encrypted and only used server-side. Access to
        production data is restricted to the account owner.
      </p>
    </Section>

    <Section id="children" n={8} title="Children" icon={Users}>
      <p>
        LeadPilot is not intended for users under 13 and we do not knowingly
        collect their data.
      </p>
    </Section>

    <Section id="changes" n={9} title="Changes to this policy" icon={FileText}>
      <p>
        We post any updates on this page and update the "Last updated" date
        above. Material changes are emailed to account holders.
      </p>
    </Section>

    <Section id="contact" n={10} title="Contact" icon={Mail}>
      <p>
        Questions or requests:{" "}
        <a href="mailto:leadpilot24@gmail.com">leadpilot24@gmail.com</a>
      </p>
    </Section>
  </Shell>
);

/* ---------- Terms ---------- */

const TERMS_TOC = [
  { id: "service", label: "1. The service" },
  { id: "account", label: "2. Account & eligibility" },
  { id: "use", label: "3. Acceptable use" },
  { id: "billing", label: "4. Billing" },
  { id: "content", label: "5. Your content" },
  { id: "ai", label: "6. AI output" },
  { id: "liability", label: "7. Disclaimer" },
  { id: "termination", label: "8. Termination" },
  { id: "changes", label: "9. Changes" },
  { id: "contact", label: "10. Contact" },
];

export const Terms = () => (
  <Shell doc="terms" toc={TERMS_TOC}>
    <Callout tone="info" icon={FileText} title="The short version">
      By creating a LeadPilot account or using the service, you agree to these
      Terms. They cover what we provide, what you're responsible for, and how
      either side can end the relationship.
    </Callout>

    <Section id="service" n={1} title="The service" icon={Globe}>
      <p>
        LeadPilot is a software-as-a-service tool that lets you connect a
        Facebook Page and use AI to automatically reply to messages and
        comments, manage products, take orders, and run scheduled campaigns.
      </p>
    </Section>

    <Section id="account" n={2} title="Account & eligibility" icon={Users}>
      <ul>
        <li>
          You must be at least 18 years old or have legal capacity to enter a
          contract.
        </li>
        <li>You are responsible for keeping your login credentials secure.</li>
        <li>
          You must own or be authorized to manage every Facebook Page you
          connect.
        </li>
      </ul>
    </Section>

    <Section id="use" n={3} title="Acceptable use" icon={ShieldCheck}>
      <p>You agree NOT to use LeadPilot to:</p>
      <ul>
        <li>Send spam, scams, or unsolicited bulk messages.</li>
        <li>Impersonate any person or business you don't represent.</li>
        <li>
          Violate Facebook's Platform Terms, Community Standards, or Messenger
          Platform Policies.
        </li>
        <li>
          Process content that is illegal, hateful, sexual, harassing, or
          harmful.
        </li>
        <li>
          Reverse engineer, resell, or sublicense the service without written
          permission.
        </li>
      </ul>
      <Callout tone="warn" title="Enforcement">
        Violations may lead to immediate suspension without refund.
      </Callout>
    </Section>

    <Section id="billing" n={4} title="Billing" icon={Database}>
      <ul>
        <li>
          LeadPilot uses prepaid credits. AI replies cost a published
          per-message rate; image analysis is included only with a paid
          subscription.
        </li>
        <li>Credits are non-refundable once consumed.</li>
        <li>
          Subscription plans renew automatically until cancelled. You can
          cancel anytime from the dashboard.
        </li>
      </ul>
    </Section>

    <Section id="content" n={5} title="Your content & data" icon={Lock}>
      <p>
        You retain ownership of all content you upload (products, FAQs, etc.).
        You grant us a limited license to process this content solely to run
        the service for you. We will not share your business data with other
        customers.
      </p>
    </Section>

    <Section id="ai" n={6} title="AI output" icon={AlertCircle}>
      <p>
        Replies are generated by AI and may contain errors. You are responsible
        for reviewing bot behavior and for any messages sent on your behalf. We
        provide controls to pause the bot at any time.
      </p>
    </Section>

    <Section id="liability" n={7} title="Disclaimer & limitation of liability" icon={ShieldCheck}>
      <p>
        The service is provided "AS IS" without warranties of any kind. To the
        maximum extent permitted by law, LeadPilot's total liability for any
        claim is limited to the amount you paid us in the 3 months preceding
        the claim.
      </p>
    </Section>

    <Section id="termination" n={8} title="Termination" icon={Trash2}>
      <p>
        You can delete your account anytime from the dashboard. We may suspend
        or terminate accounts that violate these Terms or that pose risk to
        Facebook's platform or to other users.
      </p>
    </Section>

    <Section id="changes" n={9} title="Changes" icon={Calendar}>
      <p>
        We may update these Terms. Material changes will be posted here and
        emailed to account holders at least 7 days before they take effect.
      </p>
    </Section>

    <Section id="contact" n={10} title="Contact" icon={Mail}>
      <p>
        <a href="mailto:leadpilot24@gmail.com">leadpilot24@gmail.com</a>
      </p>
    </Section>
  </Shell>
);

/* ---------- Data Deletion ---------- */

const DELETION_TOC = [
  { id: "option-a", label: "Option A — Account holders" },
  { id: "option-b", label: "Option B — Page visitors" },
  { id: "option-c", label: "Option C — Revoke access" },
  { id: "contact", label: "Contact" },
];

export const DataDeletion = () => (
  <Shell doc="deletion" toc={DELETION_TOC}>
    <Callout tone="info" icon={Trash2} title="We honor every deletion request">
      Whether you have a LeadPilot account or you just messaged a Page that
      uses LeadPilot, you can have your data removed from our systems within 30
      days. Pick the option that matches your situation.
    </Callout>

    <Section id="option-a" n={1} title="If you have a LeadPilot account" icon={Users}>
      <ol>
        <li>
          Sign in at{" "}
          <a href="https://leadpilot.life/auth">leadpilot.life/auth</a>.
        </li>
        <li>
          Go to <strong>Settings → Account</strong>.
        </li>
        <li>
          Click <strong>Delete my account</strong> and confirm.
        </li>
      </ol>
      <p>
        This permanently removes your profile, connected Facebook Pages, access
        tokens, products, conversations, orders, and billing history within 30
        days.
      </p>
    </Section>

    <Section id="option-b" n={2} title="If you messaged a Page that uses LeadPilot" icon={Mail}>
      <p>
        If you are a Facebook user and you would like the messages you sent to
        a Page (that uses LeadPilot) to be deleted from our systems, email us
        with the details below and we will remove your data within 30 days.
      </p>
      <ul>
        <li>
          To:{" "}
          <a href="mailto:leadpilot24@gmail.com">leadpilot24@gmail.com</a>
        </li>
        <li>
          Subject: <strong>Facebook Data Deletion Request</strong>
        </li>
        <li>
          Include: your Facebook profile name + a link to the Page you
          messaged.
        </li>
      </ul>
      <Callout tone="success" title="Confirmation">
        We will confirm by email once your data is removed. Note: we cannot
        delete data Facebook itself stores — for that, use Facebook's own
        settings.
      </Callout>
    </Section>

    <Section id="option-c" n={3} title="Revoke LeadPilot's access from Facebook" icon={ShieldCheck}>
      <ol>
        <li>
          Go to{" "}
          <a
            href="https://www.facebook.com/settings?tab=business_tools"
            target="_blank"
            rel="noreferrer"
          >
            facebook.com/settings → Business Integrations
          </a>
          .
        </li>
        <li>
          Find <strong>LeadPilot</strong> in the list.
        </li>
        <li>
          Click <strong>Remove</strong>.
        </li>
      </ol>
      <p>This immediately revokes our access to your Pages.</p>
    </Section>

    <Section id="contact" n={4} title="Contact" icon={Mail}>
      <p>
        Questions about deletion:{" "}
        <a href="mailto:leadpilot24@gmail.com">leadpilot24@gmail.com</a>
      </p>
    </Section>
  </Shell>
);

export default Privacy;
