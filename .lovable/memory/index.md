Facebook Auto-Reply Bot SaaS platform. Multi-tenant, Bangla-first, English supported.

- Multi-tenant: user_id on all tables
- DB tables: products, conversations, messages, bot_settings, orders, auto_reply_rules, scheduled_messages, ai_usage, user_credits, credit_transactions, user_roles, fb_pages, profiles, complaints
- Credit system: user_credits (balance per user), credit_transactions (recharge/deduction log), bot stops when balance=0
- Per-message cost: ৳0.30 per text, ৳1.50 per image (configurable via bot_settings: credit_cost_text, credit_cost_image)
- Admin can add credits via Admin Panel (bKash manual recharge flow)
- User approval: profiles.is_approved — new users default false, admin must approve from Admin Panel
- RLS: All tables isolated by user_id. Admins can read/manage all via has_role()
- Storage bucket: product-images (public)
- Edge function: fb-webhook — checks credits before AI reply, deducts after, logs usage
- AI model: google/gemini-2.5-flash (text+image), google/gemini-2.5-flash-lite (order extraction)
- Default language: Bangla (বাংলা), auto-detects English and Banglish
- Reply style: SHORT and DIRECT — max 1-2 sentences
- Dashboard sidebar: Analytics, Credits, AI Usage, AI Training, Products, Orders, Chats, Auto-Reply, Scheduled, FB Pages, Settings, Admin
- Design: Blue primary (hsl 217 72% 52%), dark sidebar, clean card-based layout
- AI Training UI: simplified — Bot Identity, Personality, Welcome Messages, FAQ, Never Say, Comment Auto-Reply
- Trigger on auth.users creates profile + user_credits row automatically
