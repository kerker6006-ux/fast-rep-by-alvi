import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) return new Response("Stripe not configured", { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (err) {
    console.error("Signature verify failed:", (err as Error).message);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const addCredits = async (userId: string, amount: number, type: string, description: string, sessionId?: string) => {
    const { error: txErr } = await supabase.from("credit_transactions").insert({
      user_id: userId, amount, type, description, stripe_session_id: sessionId ?? null,
    });
    if (txErr) {
      if ((txErr as any).code === "23505") {
        console.log("Duplicate session, skipping:", sessionId);
        return false;
      }
      throw txErr;
    }
    const { data: cur } = await supabase.from("user_credits").select("balance").eq("user_id", userId).maybeSingle();
    const newBal = Number(cur?.balance ?? 0) + amount;
    if (cur) {
      await supabase.from("user_credits").update({ balance: newBal }).eq("user_id", userId);
    } else {
      await supabase.from("user_credits").insert({ user_id: userId, balance: newBal });
    }
    return true;
  };

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const flow = session.metadata?.flow;
      if (!userId) {
        console.warn("Missing user_id in session metadata", session.id);
        return new Response("ok", { status: 200 });
      }

      if (flow === "subscription" && session.mode === "subscription") {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        await supabase.from("profiles").update({
          subscription_status: "active",
          subscription_id: subId ?? null,
          subscription_plan: "basic",
        }).eq("id", userId);
        // $5 bonus credit on first subscription activation (idempotent via stripe_session_id)
        const added = await addCredits(userId, 5, "recharge", "Subscription welcome bonus", session.id);
        if (added) {
          // Send subscription confirmation email (best-effort)
          try {
            const { data: prof } = await supabase
              .from("profiles").select("display_name").eq("id", userId).maybeSingle();
            const email = session.customer_details?.email
              ?? session.customer_email
              ?? (await supabase.auth.admin.getUserById(userId)).data.user?.email;
            if (email) {
              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "subscription-activated",
                  recipientEmail: email,
                  idempotencyKey: `sub-active-${session.id}`,
                  templateData: { name: prof?.display_name ?? null, plan: "Basic", bonusCredit: 5 },
                },
              });
            }
          } catch (e) { console.error("subscription email failed", e); }
        }
      } else if (flow === "topup" && session.mode === "payment") {
        const amount = Number(session.amount_total ?? 0) / 100;
        if (amount > 0) {
          await addCredits(userId, amount, "recharge", `Stripe top-up`, session.id);
        }
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (userId) {
        const status = event.type === "customer.subscription.deleted" ? "cancelled" : sub.status;
        const periodEnd = (sub as any).current_period_end
          ? new Date((sub as any).current_period_end * 1000).toISOString() : null;
        await supabase.from("profiles").update({
          subscription_status: status,
          subscription_current_period_end: periodEnd,
        }).eq("id", userId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook handler error", e);
    return new Response("handler error", { status: 500 });
  }
});
