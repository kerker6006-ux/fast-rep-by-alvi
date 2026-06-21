## Goal

Replace "Image Inbox" with a unified "Alert Box" for conversations the bot couldn't or wouldn't handle, and clean up the 24-hour Facebook warning so it shows clearly only when it matters.

## 1. Replace Image Inbox with Alert Box

In `src/components/ConversationsView.tsx` and `src/components/DashboardSidebar.tsx`:

- Rename the second tab from "Image Inbox" to **"Alert Box"** (icon: `Bell` or `AlertCircle`).
- Remove the image-only filter logic. The Alert Box lists every conversation flagged as **needs human reply**, which includes:
  - Bot didn't understand / low confidence (already tracked via `conversations.needs_human` + `followup_reason`).
  - Customer sent an image while **image analysis is OFF** (free plan default, or user-disabled).
- Sort by most recent alert first. Red badge count = unread alerts. Count decreases as user opens each alert conversation (mark `needs_human=false` or add a `seen_at` once viewed).
- Delete the separate `ImageInbox.tsx` route/component usage from the sidebar.

## 2. Bot behavior — route to Alert Box instead of replying

In `supabase/functions/fb-webhook/index.ts`:

- When an incoming message has an **image attachment** AND the user's plan has image analysis disabled (free plan, or `bot_settings.image_analysis_enabled = false`):
  - Do **not** call the AI.
  - Do **not** send any reply to the customer.
  - Set `conversations.needs_human = true`, `followup_reason = "Image received — image analysis is off"`.
- When AI confidence is low / bot has no good answer (existing "needs_human" path):
  - Same: don't reply, flag the conversation for the Alert Box.

## 3. First-time explainer (dismiss forever)

When the user opens the Alert Box for the very first time, show a small info banner at the top:

> **What is the Alert Box?**
> When the bot isn't sure how to reply, or a customer sends something it can't handle (like an image on the free plan), the conversation lands here so you can reply yourself.

- A small **×** dismiss button.
- Persist dismissal in `profiles` via a new boolean column `alert_box_intro_dismissed` (migration). Once dismissed, never show again on any device.

## 4. Clear, dismissible 24-hour Facebook warning

In `ConversationsView.tsx` (and the same pattern when sending scheduled/manual messages elsewhere):

- Replace the current amber paragraph with a shorter, plain-English version:

  > **Facebook 24-hour rule:** You can only reply within 24 hours of the customer's last message. They need to message you again to reopen the chat.

- Add a small **×** to dismiss. Persist dismissal in `profiles.fb_24h_notice_dismissed` (same migration).
- Behavior:
  - **Once dismissed**, the banner never shows again at the top of conversations.
  - **However**, if the user actually tries to send a reply outside the 24h window (here or from any other send surface), the same one-line message pops up as a **toast** to explain why the send was blocked — every time they attempt it (this is the failure reason, not the banner).

## 5. Free plan default

- New signups: `bot_settings.image_analysis_enabled = false` by default (already set in the prior plan's migration — confirm and keep).
- Toggling it ON still requires an active subscription (existing gating stays).

## Technical notes

- Migration: add two boolean columns to `profiles` — `alert_box_intro_dismissed`, `fb_24h_notice_dismissed`, both default `false`.
- Sidebar label key: rename `chats.imageInbox` → `chats.alertBox` across `en/bn/ko/es` locale files.
- The unread-alert badge query: `conversations` where `needs_human = true AND (alert_seen_at IS NULL OR alert_seen_at < last_message_at)` — add `alert_seen_at timestamptz` to `conversations` so reopening an alert reduces the count without losing the "needs human" status until the user replies.
- `fb-webhook`: short-circuit before AI call when image + image_analysis disabled; record incoming message normally so it appears in the thread, then flag conversation.
- Remove `ImageInbox.tsx` import/route; keep file deletion out of scope only if referenced elsewhere — otherwise delete.
