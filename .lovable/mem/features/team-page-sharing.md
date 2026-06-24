---
name: Team & Page Sharing
description: Per-page invites with Owner / Full Access / Moderator roles, gmail-only invites, page-scoped data isolation enforced by RLS
type: feature
---

# Page sharing

Owners can invite teammates per-page via the **Team & Access** card in Bot Settings.

- Two roles: `full` (Full Access) and `moderator`.
- Owners and Full Access members can invite & remove **both** roles. Only the owner can disconnect a page.
- Moderators see only Conversations, Orders, Appointments/Callbacks, Notifications. They cannot change bot settings, training, products, services, billing, scheduled messages, comment triggers, or analytics.
- Invites are gmail-only. On accept, if the gmail user doesn't exist, a new auth user is auto-created and a password-reset email is sent.

## Data model
- `page_members(page_id, user_id, role, invited_by)` — unique (page_id, user_id).
- `page_invites(page_id, email, role, token, status, expires_at, ...)` — unique pending (page_id, email).
- Tables tagged with `fb_page_id` (uuid FK to `fb_pages.id`) include conversations, messages, orders, complaints, products, services, bot_settings, auto_reply_rules, scheduled_messages, website_knowledge, training_suggestions, pending_products, product_suggestions, leads, notifications.
- Helpers: `user_page_role`, `user_has_page_access`, `user_can_manage_page`, plus text variants `user_has_fb_page_access` / `user_can_manage_fb_page` for `comment_triggers`.
- RLS pattern: SELECT = owner OR member; sensitive writes = owner OR full; chat/orders/complaints writes = any member.
- `notify_new_order` / `notify_new_complaint` triggers fan out notifications to owner + every page member.

## Edge functions
- `invite-page-member`, `accept-page-invite`, `revoke-page-invite`, `remove-page-member`. All in `supabase/functions/`.

## Frontend
- `useActivePage` returns pages = owned ∪ shared, each with `access_role`.
- `MODERATOR_ALLOWED_TABS` in `src/lib/pageAccess.ts` governs sidebar visibility and tab auto-redirect.
- `TeamAccessCard` renders in `BotSettings` for owners + full users only.
- `/accept-invite` page handles the token redemption.

## Webhook plumbing
- `fb-webhook` selects `fb_pages.id` and propagates it as `fbPageRowId` through `handleMessagingEvent → getOrCreateConversation → messages/orders/complaints inserts` so member access works on new rows. Existing rows pre-migration have NULL `fb_page_id` and remain visible only to the owner.
