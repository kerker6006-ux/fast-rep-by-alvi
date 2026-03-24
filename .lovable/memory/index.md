Facebook Auto-Reply Bot SaaS platform. Multi-tenant, Bangla-first, English supported.

- Multi-tenant: user_id on all tables (products, conversations, messages, bot_settings, orders, auto_reply_rules, scheduled_messages, ai_usage)
- DB tables: + user_roles (app_role enum: admin/user), fb_pages (per-user FB page connection with access token), profiles, ai_usage (tracks every AI call with type/model/cost)
- RLS: All tables isolated by user_id. Admins can read all via has_role() security definer function.
- Storage bucket: product-images (public)
- Edge function: fb-webhook (looks up fb_pages by page_id to find user_id, uses per-user settings/products/rules, logs AI usage per call)
- AI model: google/gemini-2.5-flash (both text and image), google/gemini-2.5-flash-lite (order extraction)
- Default language: Bangla (বাংলা), auto-detects English and Banglish
- Reply style: SHORT and DIRECT — max 1-2 sentences, no flattery, no repeating customer's words back
- Each user connects their own FB page via FB Pages tab (stores page_access_token per user)
- Fallback: global FB_PAGE_ACCESS_TOKEN secret for backward compat
- Admin panel: shows all users, their stats (products/orders/chats), connected FB pages
- bot_settings unique constraint: (user_id, setting_key) — per-user settings
- Dashboard sidebar: Analytics, AI Usage, AI Training, Products, Orders, Chats, Auto-Reply, Scheduled, FB Pages, Settings, Admin (admin-only)
- Design: Blue primary (hsl 217 72% 52%), dark sidebar, clean card-based layout
- AI Training UI: simplified — Bot Identity, Personality, Welcome Messages, FAQ, Never Say, Comment Auto-Reply
- AI Usage: tracks text (~$0.0005), image (~$0.003), order_detection (~$0.0002) per call with 7-day chart
