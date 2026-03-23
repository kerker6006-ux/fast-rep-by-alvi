Facebook Auto-Reply Bot for business page. Bangla-first, English supported.

- DB tables: products, conversations, messages, bot_settings, orders, auto_reply_rules, scheduled_messages
- Enums: order_status (pending/confirmed/processing/delivered/cancelled), scheduled_message_status (pending/sent/failed/cancelled)
- Storage bucket: product-images (public)
- Edge functions: fb-webhook (handles FB webhook + AI replies + auto-reply rules + order detection), send-scheduled (cron every minute, sends pending scheduled messages)
- AI model: google/gemini-2.5-flash (main replies), google/gemini-2.5-flash-lite (order extraction)
- Default language: Bangla (বাংলা), auto-detects English
- Needs FB_PAGE_ACCESS_TOKEN secret to work
- Cron job: send-scheduled-messages runs every minute via pg_cron + pg_net
- Dashboard tabs: Analytics, Products, Orders, Chats, Auto-Reply, Scheduled, Settings
