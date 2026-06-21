import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const flow: "subscription" | "topup" = body.flow === "topup" ? "topup" : "subscription";
    const origin = req.headers.get("origin") ?? "https://leadpilot.life";

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse customer if we already have one.
    const { data: profile } = await supabase
      .from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    let session;
    if (flow === "subscription") {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: 2000, // $20.00
            recurring: { interval: "month" },
            product_data: { name: "LeadPilot Basic Plan" },
          },
          quantity: 1,
        }],
        success_url: `${origin}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard?billing=cancelled`,
        metadata: { user_id: user.id, flow: "subscription", plan: "basic" },
        subscription_data: { metadata: { user_id: user.id, plan: "basic" } },
      });
    } else {
      const amount = Math.max(1, Math.min(1000, Number(body.amount ?? 0)));
      if (!Number.isFinite(amount) || amount < 1) {
        return new Response(JSON.stringify({ error: "Minimum top-up is $1" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Top-ups available to all users (no subscription required)
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: { name: `LeadPilot Balance Top-up ($${amount.toFixed(2)})` },
          },
          quantity: 1,
        }],
        success_url: `${origin}/dashboard?billing=topup-success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard?billing=cancelled`,
        metadata: { user_id: user.id, flow: "topup", amount_usd: String(amount) },
      });
    }

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout-session error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
