Facebook Auto-Reply Bot SaaS platform. Multi-tenant, Bangla-first, English supported.

- Multi-tenant: user_id on all tables (products, conversations, messages, bot_settings, orders, auto_reply_rules, scheduled_messages)
- DB tables: + user_roles (app_role enum: admin/user), fb_pages (per-user FB page connection with access token), profiles
- RLS: All tables isolated by user_id. Admins can read all via has_role() security definer function.
- Storage bucket: product-images (public)
- Edge function: fb-webhook (looks up fb_pages by page_id to find user_id, uses per-user settings/products/rules)
- AI model: google/gemini-2.5-flash (main replies), google/gemini-2.5-flash-lite (order extraction)
- Default language: Bangla (বাংলা), auto-detects English
- Each user connects their own FB page via FB Pages tab (stores page_access_token per user)
- Fallback: global FB_PAGE_ACCESS_TOKEN secret for backward compat
- Admin panel: shows all users, their stats (products/orders/chats), connected FB pages
- bot_settings unique constraint: (user_id, setting_key) — per-user settings
- Dashboard sidebar: Analytics, AI Training, Products, Orders, Chats, Auto-Reply, Scheduled, FB Pages, Settings, Admin (admin-only)
- Design: Blue primary (hsl 217 72% 52%), dark sidebar, clean card-based layout
