import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_API_VERSION = "2026-02-25.preview" as any;

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
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const {
      name = "Basic subscription",
      description = "A basic subscription to our service",
      unit_amount = 1000,
      currency = "usd",
      interval = "month",
      tax_code = "txcd_10103100",
      mode = "subscription",
      quantity = 1,
      price_id,
      success_url,
      cancel_url,
    } = body;

    const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

    let priceId = price_id as string | undefined;
    if (!priceId) {
      const product = await stripe.products.create(
        {
          name,
          description,
          tax_code,
          default_price_data: {
            unit_amount,
            currency,
            recurring: mode === "subscription" ? { interval } : undefined,
          },
        } as any,
        { apiVersion: STRIPE_API_VERSION } as any
      );
      priceId = (product.default_price as string) ?? undefined;
      if (!priceId) throw new Error("Failed to create default price");
    }

    const origin = req.headers.get("origin") ?? "https://leadpilot.life";
    const session = await stripe.checkout.sessions.create(
      {
        line_items: [{ price: priceId, quantity }],
        mode,
        managed_payments: { enabled: true },
        customer_email: user.email ?? undefined,
        success_url: success_url ?? `${origin}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancel_url ?? `${origin}/billing?status=cancelled`,
        metadata: { user_id: user.id },
      } as any,
      { apiVersion: STRIPE_API_VERSION } as any
    );

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout-session error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
