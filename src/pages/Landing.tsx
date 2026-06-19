import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Plane,
  MessageSquare,
  Brain,
  Target,
  TrendingUp,
  Link2,
  Database,
  Rocket,
  ArrowRight,
  Check,
  Sparkles,
  Instagram,
  Facebook,
} from "lucide-react";

const features = [
  { icon: MessageSquare, title: "Instant Auto-Replies", desc: "Replies to every DM on Facebook & Instagram instantly. 24/7. No customer is ever ignored." },
  { icon: Brain, title: "Smart Conversations", desc: "Understands intent — price, booking, questions — and replies like a real human sales agent." },
  { icon: Target, title: "Lead Qualification", desc: "Detects serious buyers vs casual chatters and asks smart follow-up questions automatically." },
  { icon: TrendingUp, title: "Converts Chats to Customers", desc: "Sends offers, pricing, service details, and guides users step-by-step toward purchase." },
  { icon: Link2, title: "One-Click Page Connect", desc: "Connect your Facebook and Instagram in seconds. No technical setup, no code." },
  { icon: Database, title: "CRM-Style Lead Tracking", desc: "Every lead stored, every conversation tracked. See hot leads ready to buy at a glance." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-glow">
              <Plane className="w-5 h-5 text-primary-foreground -rotate-45" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">LeadPilot</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow shadow-glow">
                Get Started <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-mesh)" }}
        />
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-soft text-accent-foreground text-xs font-medium mb-8 border border-primary/10">
            <Sparkles className="w-3.5 h-3.5" />
            AI Sales Co-Pilot for FB & Instagram
          </div>
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            Your AI co-pilot that
            <br />
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              flies every lead to a sale.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-10">
            LeadPilot navigates, controls, and converts every Facebook & Instagram message into a paying
            customer — automatically. You focus on growing. We handle the conversations.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary-glow shadow-glow h-12 px-7 text-base">
                Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                See how it works
              </Button>
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Facebook className="w-4 h-4" /> Facebook</div>
            <div className="flex items-center gap-2"><Instagram className="w-4 h-4" /> Instagram</div>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-success" /> 24/7 replies</div>
          </div>

          {/* Floating chat mock */}
          <div className="relative max-w-3xl mx-auto mt-16">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary-glow/20 blur-3xl rounded-full" />
            <div className="relative bg-card border border-border rounded-3xl shadow-elevated p-6 text-left">
              <div className="flex items-center gap-2 pb-4 border-b border-border">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">LeadPilot · live</span>
              </div>
              <div className="space-y-3 pt-4">
                <div className="flex">
                  <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm max-w-[75%] text-sm">
                    Hi, do you have this in red?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground px-4 py-2 rounded-2xl rounded-br-sm max-w-[75%] text-sm">
                    Yes! Red is in stock — 1,250৳. Want me to confirm your order? 🛍️
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm max-w-[75%] text-sm">
                    Yes please, my number is 017xxxxxxxx
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground px-4 py-2 rounded-2xl rounded-br-sm max-w-[75%] text-sm">
                    Order confirmed ✈️ Address please?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Not just a reply bot. A <span className="text-primary">sales system.</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            LeadPilot handles the entire journey — from first DM to closed sale — like a skilled pilot
            guiding every conversation safely to landing.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-7 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-elevated transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary grid place-items-center mb-5 group-hover:scale-110 transition-transform">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-br from-primary-soft to-background border border-primary/10 rounded-3xl p-10 md:p-16">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
              From DM to sale in 3 steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: "01", t: "Connect your page", d: "One click to link Facebook & Instagram. No technical setup." },
              { n: "02", t: "Train your pilot", d: "Add products, FAQs, pricing. LeadPilot learns your business in minutes." },
              { n: "03", t: "Watch sales fly in", d: "LeadPilot replies, qualifies, and converts leads automatically — 24/7." },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="font-display text-6xl font-bold bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent mb-3">
                  {s.n}
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{s.t}</h3>
                <p className="text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="relative rounded-3xl overflow-hidden p-12 md:p-20 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow">
          <Rocket className="w-12 h-12 mx-auto mb-6 opacity-90" />
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Ready to put your sales on autopilot?
          </h2>
          <p className="opacity-90 max-w-xl mx-auto mb-8">
            Stop losing leads to slow replies. Let LeadPilot turn every message into revenue —
            while you sleep.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="h-12 px-8 text-base font-semibold">
              Get Started — It's Free <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 -rotate-45 text-primary" />
            <span>© {new Date().getFullYear()} LeadPilot. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            <Link to="/auth" className="hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
