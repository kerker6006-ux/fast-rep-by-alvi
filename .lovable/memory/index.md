Facebook Auto-Reply Bot for business page. Bangla-first, English supported.

- DB tables: products, conversations, messages, bot_settings, orders, auto_reply_rules, scheduled_messages
- Enums: order_status (pending/confirmed/processing/delivered/cancelled), scheduled_message_status (pending/sent/failed/cancelled)
- Storage bucket: product-images (public)
- Edge functions: fb-webhook (handles FB webhook + AI replies + auto-reply rules + order detection + comment auto-reply), send-scheduled (cron every minute)
- AI model: google/gemini-2.5-flash (main replies), google/gemini-2.5-flash-lite (order extraction)
- Default language: Bangla (বাংলা), auto-detects English
- Needs FB_PAGE_ACCESS_TOKEN secret to work
- Cron job: send-scheduled-messages runs every minute via pg_cron + pg_net
- Dashboard: Professional sidebar nav with tabs: Analytics, AI Training, Products, Orders, Chats, Auto-Reply, Scheduled, Settings
- AI Training: personality, tone, reply examples, understanding rules, never-say list, image instructions, comment auto-reply config
- Comment auto-reply: replies to FB post comments with "inbox us" message
- Design: Blue primary (hsl 217 72% 52%), dark sidebar, clean card-based layout
- FB webhook also handles feed/changes for comment events
