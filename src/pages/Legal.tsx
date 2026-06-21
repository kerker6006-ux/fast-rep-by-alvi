import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Header = ({ title, updated }: { title: string; updated: string }) => (
  <header className="border-b border-border">
    <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to LeadPilot
      </Link>
      <span className="text-xs text-muted-foreground">Last updated: {updated}</span>
    </div>
    <div className="max-w-3xl mx-auto px-6 pb-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
    </div>
  </header>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <article className="max-w-3xl mx-auto px-6 py-10 prose prose-slate dark:prose-invert prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-p:leading-relaxed prose-li:my-1">
    {children}
  </article>
);

export const Privacy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Header title="Privacy Policy" updated="June 21, 2026" />
    <Shell>
      <p>
        LeadPilot ("we", "us", "our") provides an AI assistant that connects to Facebook Pages
        owned by our customers to automatically reply to their customers' messages and comments.
        This Privacy Policy explains what information we collect, how we use it, and the rights
        you have over it.
      </p>

      <h2>1. Who this policy applies to</h2>
      <p>This policy applies to:</p>
      <ul>
        <li><strong>Account holders</strong> — people who sign up for LeadPilot and connect a Facebook Page.</li>
        <li><strong>Page visitors</strong> — people who send messages or comments to a Facebook Page that uses LeadPilot.</li>
      </ul>

      <h2>2. Information we collect</h2>
      <p>From <strong>account holders</strong>:</p>
      <ul>
        <li>Name, email address, and profile picture from Google or email sign-up.</li>
        <li>Facebook user ID, name, profile picture, list of Pages you manage, and a Page access token (with the permissions you grant).</li>
        <li>Billing information (handled by Stripe — we never see card numbers).</li>
        <li>Your training data: product catalog, FAQs, business category, bot persona settings.</li>
      </ul>
      <p>From <strong>page visitors</strong> (collected on behalf of the account holder):</p>
      <ul>
        <li>Facebook user ID and public name (so the bot can address them).</li>
        <li>Messages, comments, and images sent to the connected Page.</li>
        <li>Any contact details (name, phone, address) the visitor voluntarily shares while placing an order.</li>
      </ul>

      <h2>3. How we use the information</h2>
      <ul>
        <li>To deliver replies, generate orders, and run the AI assistant for the connected Page.</li>
        <li>To bill the account holder for AI usage (per-message and per-image charges).</li>
        <li>To prevent abuse, debug errors, and improve the service.</li>
        <li>To send transactional emails (login, billing receipts, low balance alerts).</li>
      </ul>
      <p>We do <strong>not</strong> sell personal data and we do <strong>not</strong> use Facebook user data for advertising.</p>

      <h2>4. Sharing with third parties</h2>
      <p>We use these subprocessors strictly to operate the service:</p>
      <ul>
        <li><strong>Supabase / Lovable Cloud</strong> — database, authentication, and edge functions.</li>
        <li><strong>Google Gemini & OpenRouter</strong> — to generate AI replies. Messages may be sent to these providers for inference.</li>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Meta (Facebook)</strong> — to read and send messages on the connected Page via the Graph API.</li>
      </ul>

      <h2>5. Data retention</h2>
      <ul>
        <li>Conversation history is kept while your account is active so the bot can maintain context. Account holders can delete individual conversations at any time.</li>
        <li>If you disconnect a Facebook Page, the Page access token is revoked and removed.</li>
        <li>If you delete your account, all your data is permanently removed within 30 days.</li>
      </ul>

      <h2>6. Your rights</h2>
      <p>
        You can access, export, or delete your data at any time from the dashboard, or by emailing
        us at <a href="mailto:fastrepbyalvi@gmail.com">fastrepbyalvi@gmail.com</a>. Facebook users
        whose messages were processed can request deletion via the same email or via the
        <Link to="/data-deletion"> Data Deletion</Link> page.
      </p>

      <h2>7. Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest. Access tokens are stored encrypted and
        only used server-side. Access to production data is restricted to the account owner.
      </p>

      <h2>8. Children</h2>
      <p>LeadPilot is not intended for users under 13 and we do not knowingly collect their data.</p>

      <h2>9. Changes to this policy</h2>
      <p>
        We will post any updates on this page and update the "Last updated" date above. Material
        changes will be emailed to account holders.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or requests: <a href="mailto:fastrepbyalvi@gmail.com">fastrepbyalvi@gmail.com</a>
      </p>
    </Shell>
  </div>
);

export const Terms = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Header title="Terms of Service" updated="June 21, 2026" />
    <Shell>
      <p>By creating a LeadPilot account or using the service, you agree to these Terms.</p>

      <h2>1. The service</h2>
      <p>
        LeadPilot is a software-as-a-service tool that lets you connect a Facebook Page and use AI
        to automatically reply to messages and comments, manage products, take orders, and run
        scheduled campaigns.
      </p>

      <h2>2. Account & eligibility</h2>
      <ul>
        <li>You must be at least 18 years old or have legal capacity to enter a contract.</li>
        <li>You are responsible for keeping your login credentials secure.</li>
        <li>You must own or be authorized to manage every Facebook Page you connect.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree NOT to use LeadPilot to:</p>
      <ul>
        <li>Send spam, scams, or unsolicited bulk messages.</li>
        <li>Impersonate any person or business you don't represent.</li>
        <li>Violate Facebook's Platform Terms, Community Standards, or Messenger Platform Policies.</li>
        <li>Process content that is illegal, hateful, sexual, harassing, or harmful.</li>
        <li>Reverse engineer, resell, or sublicense the service without written permission.</li>
      </ul>
      <p>Violations may lead to immediate suspension without refund.</p>

      <h2>4. Billing</h2>
      <ul>
        <li>LeadPilot uses prepaid credits. AI replies cost a published per-message rate; image analysis is included only with a paid subscription.</li>
        <li>Credits are non-refundable once consumed.</li>
        <li>Subscription plans renew automatically until cancelled. You can cancel anytime from the dashboard.</li>
      </ul>

      <h2>5. Your content & data</h2>
      <p>
        You retain ownership of all content you upload (products, FAQs, etc.). You grant us a
        limited license to process this content solely to run the service for you. We will not
        share your business data with other customers.
      </p>

      <h2>6. AI output</h2>
      <p>
        Replies are generated by AI and may contain errors. You are responsible for reviewing
        bot behavior and for any messages sent on your behalf. We provide controls to pause the
        bot at any time.
      </p>

      <h2>7. Disclaimer & limitation of liability</h2>
      <p>
        The service is provided "AS IS" without warranties of any kind. To the maximum extent
        permitted by law, LeadPilot's total liability for any claim is limited to the amount you
        paid us in the 3 months preceding the claim.
      </p>

      <h2>8. Termination</h2>
      <p>
        You can delete your account anytime from the dashboard. We may suspend or terminate
        accounts that violate these Terms or that pose risk to Facebook's platform or to other users.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these Terms. Material changes will be posted here and emailed to account
        holders at least 7 days before they take effect.
      </p>

      <h2>10. Contact</h2>
      <p>
        <a href="mailto:fastrepbyalvi@gmail.com">fastrepbyalvi@gmail.com</a>
      </p>
    </Shell>
  </div>
);

export const DataDeletion = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Header title="Data Deletion Instructions" updated="June 21, 2026" />
    <Shell>
      <p>
        LeadPilot respects your right to delete data we hold about you. This page explains exactly
        how to request deletion, whether you're a LeadPilot account holder or a Facebook user whose
        messages were processed by a Page that uses LeadPilot.
      </p>

      <h2>Option A — If you have a LeadPilot account</h2>
      <ol>
        <li>Sign in at <a href="https://leadpilot.life/auth">leadpilot.life/auth</a>.</li>
        <li>Go to <strong>Settings → Account</strong>.</li>
        <li>Click <strong>Delete my account</strong> and confirm.</li>
      </ol>
      <p>
        This permanently removes your profile, connected Facebook Pages, access tokens, products,
        conversations, orders, and billing history within 30 days.
      </p>

      <h2>Option B — If you messaged a Page that uses LeadPilot</h2>
      <p>
        If you are a Facebook user and you would like the messages you sent to a Page (that uses
        LeadPilot) to be deleted from our systems, email us with the details below and we will
        remove your data within 30 days.
      </p>
      <ul>
        <li>To: <a href="mailto:fastrepbyalvi@gmail.com">fastrepbyalvi@gmail.com</a></li>
        <li>Subject: <strong>Facebook Data Deletion Request</strong></li>
        <li>Include: your Facebook profile name + a link to the Page you messaged.</li>
      </ul>
      <p>
        We will confirm by email once your data is removed. Note: we cannot delete data Facebook
        itself stores — for that, use Facebook's own settings.
      </p>

      <h2>Option C — Revoke LeadPilot's access from your Facebook account</h2>
      <ol>
        <li>Go to <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noreferrer">facebook.com/settings → Business Integrations</a>.</li>
        <li>Find <strong>LeadPilot</strong> in the list.</li>
        <li>Click <strong>Remove</strong>.</li>
      </ol>
      <p>This immediately revokes our access to your Pages.</p>

      <h2>Contact</h2>
      <p>
        Questions about deletion: <a href="mailto:fastrepbyalvi@gmail.com">fastrepbyalvi@gmail.com</a>
      </p>
    </Shell>
  </div>
);

export default Privacy;
