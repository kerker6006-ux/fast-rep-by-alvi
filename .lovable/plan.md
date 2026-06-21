## Billing model changes

**Signup bonus & free month**
- New users get `$2.00` credit on signup and a `free_until = signup + 30 days` timestamp on `profiles`.
- During free month: text replies still deduct from balance (rate unchanged). When balance hits $0, bot pauses until top-up.
- Image analysis is **OFF by default** on the Free plan and the toggle is locked.
- After 30 days: Stripe auto-subscribes at $20/month (existing Basic plan). If no active subscription and free month expired → bot pauses with "Subscribe to continue" banner.
- Top-ups remain available throughout (no longer gated by subscription during the free month).

**DB migration**
- `profiles.free_until timestamptz` (default `now() + 30 days`), backfill existing users.
- `handle_new_user_credits` trigger: seed `user_credits.balance = 2.00` + insert `credit_transactions` row "Welcome bonus".
- New `bot_settings.enable_image_analysis` already exists — enforce server-side that it can only be `true` when subscription is active.

## AI Training cost tracking

- `ai-training-chat` edge function already calls Lovable AI. Add `ai_usage` inserts with `call_type = 'training'` and cost.
- `AiTraining.tsx`: add a small "AI training spend" card at the top showing lifetime + this-month totals (query `ai_usage` where `call_type = 'training'`).
- `AiUsageDashboard.tsx`: add a third "Training" card alongside Text and Image.

## Image inbox redesign

- Move `ImageInbox` from its own sidebar entry into the **Chat / Conversations** section as a sub-tab next to "All conversations".
- Add unread counter: count `messages` where `direction='incoming' AND image_url IS NOT NULL AND read_at IS NULL` for current user. Show as red badge on the "Image Inbox" tab and on the sidebar Chat entry.
- Clicking the tab marks visible image messages as read (`update messages set read_at = now() where ...`) → badge decrements in realtime.
- Sort: conversations with images sorted by their latest image `created_at DESC` (senders who sent images bubble to top).
- When `enable_image_analysis = false` and an incoming message has an image:
  - Skip Gemini vision call (no charge).
  - Bot does NOT auto-reply about the image.
  - Insert a `notifications` row: type `image_received`, link to image inbox.
  - Image still stored and shown in Image Inbox.

## Subscription gate for image analysis

- `BotSettings.tsx`: image-analysis switch is disabled with tooltip "Subscribe to enable" when `subscription_status !== 'active'`.
- Server-side guard in `fb-webhook`: if user has no active sub, force `enable_image_analysis = false` regardless of stored value.

## Files to change

**Migrations**
- New migration: add `free_until`, backfill, update `handle_new_user_credits` to seed $2 + transaction row.

**Edge functions**
- `fb-webhook/index.ts` — honor `enable_image_analysis`; insert `image_received` notification when off.
- `ai-training-chat/index.ts` — log `ai_usage` with `call_type='training'`.
- `create-checkout-session` — keep, but remove "subscription required for top-up" gate.

**Frontend**
- `src/components/CreditDashboard.tsx` — show $2 welcome + free-until countdown; remove "subscribe first to top up" warning.
- `src/components/BotSettings.tsx` — disable image toggle without active sub, show upgrade CTA.
- `src/components/AiTraining.tsx` — add training spend card.
- `src/components/AiUsageDashboard.tsx` — add Training card.
- `src/components/ConversationsView.tsx` — add tabs: "All" | "Image Inbox (N)"; integrate `ImageInbox` content; mark-as-read on view.
- `src/components/DashboardSidebar.tsx` — remove standalone Image Inbox entry; show red unread badge on Chat.
- `src/components/ImageInbox.tsx` — refactor to embedded view; sort by latest image; mark read on render.
- `src/pages/Index.tsx` — drop the separate image-inbox route entry.
- i18n: add new strings (en/bn/ko/es).

## Out of scope
- Changing text-reply pricing.
- Auto-renewal logic beyond Stripe's existing subscription (already handled by `stripe-webhook`).
- Refunding the $2 if user subscribes early.
