
# FastRep Big Update — Full Plan

## Honest feasibility snapshot
- ✅ **9 of 11 items** map cleanly to Lovable Cloud (Supabase + Edge Functions + Realtime + pg_cron).
- ⚠️ **Queues/workers** → Cloud-native: `job_queue` table + `pg_cron` poller + edge worker. Good for thousands of users; not BullMQ-grade.
- ⚠️ **Rate limiting** → ad-hoc per-user counter in webhook (no native primitive).
- ⚠️ **Daily backups** → Lovable Cloud auto-backups exist at the platform level; I won't script custom dumps. Rollback = restore via support.
- ⚠️ **FB read/delivery status** → only what Messenger Platform exposes (`message_reads`, `message_deliveries`); subject to Meta's limits.

---

## Phase 1 — Messaging Core (Features 1, 3, 4, 5)

### 1. Facebook Comment Trigger Automation (ManyChat-style)
- **New table `comment_triggers`**: `user_id`, `fb_page_id`, `keywords text[]`, `match_type` (exact/contains/starts_with), `dm_message`, `dm_image_url`, `is_enabled`, `priority`, `daily_limit`, stats counters.
- **New table `comment_trigger_logs`**: `trigger_id`, `fb_comment_id` (unique), `fb_post_id`, `commenter_id`, `commenter_name`, `dm_sent_at`, `dm_status`, `error`.
- **Extend `fb-webhook`**: handle `feed` change events (comment.add); match keywords case-insensitively; send Messenger Private Reply via Graph API; log every attempt; respect `is_enabled` and `daily_limit`.
- **UI**: New "Comment Triggers" sidebar tab — list/create/edit/toggle triggers; logs view with sent/failed status.

### 3. Disable Image Analysis toggle
- Add `enable_image_analysis` to `bot_settings` (default true).
- `fb-webhook`: when image arrives and toggle off → skip Gemini vision call, route to Image Inbox only, no AI cost.
- UI toggle in **Settings → Bot Behavior**.

### 4. Separate Image Inbox
- New tab **"Image Inbox"** in sidebar.
- Query: `messages` where `image_url is not null` AND `direction = 'incoming'`, grouped by conversation.
- Thumbnails grid → click to open full image + thread context + manual reply box.

### 5. Reply to FB messages from inside FastRep
- New edge function `send-fb-message`: takes `conversation_id` + text/image, validates 24h window (last incoming message ≤ 24h), calls Graph `/me/messages` with page access token, inserts outgoing row into `messages`.
- ConversationsView gets a reply composer (text + image upload) with 24h-window warning banner when expired.
- Extend `fb-webhook` to record `message_reads` & `message_deliveries` events → new columns `read_at`, `delivered_at` on `messages`.

---

## Phase 2 — Costs & Analytics (Features 2, 10)

### 2. Separate AI Costs dashboard
- Refactor `AiUsageDashboard.tsx` into 3 card groups:
  - **Text AI**: count, tokens (add `tokens_used` to `ai_usage` if missing), cost.
  - **Image Analysis**: count, cost.
  - **Total**: combined cost + today vs all-time.
- Update chart with stacked text/image bars; cost breakdown table.

### 10. Admin Analytics expansion
- Extend `AdminAnalytics.tsx`: total users, active (last 7d), new signups (last 7d), total text/image messages, total text/image cost, failed webhooks count, system health (last webhook ts, edge function errors via `webhook_failures` table).
- **New table `webhook_failures`**: `source`, `payload jsonb`, `error`, `retry_count`, `resolved_at` — populated by `fb-webhook` catch blocks.

---

## Phase 3 — Notifications (Feature 6)

### 6. Real-time notifications
- **New table `notifications`**: `user_id`, `type` (order/appointment/comment_trigger/image_received/needs_human), `title`, `body`, `link`, `read_at`.
- DB triggers on `orders` INSERT and `complaints` INSERT (treat complaints as appointment-like callbacks) → insert into `notifications`.
- Enable Realtime on `notifications`.
- Frontend `NotificationBell` in `DashboardHeader`: subscribes, shows red badge with count, dropdown list, plays sound, fires `Notification` API (requests permission), marks read on click. Toast popup for new ones.

---

## Phase 4 — Scale & Reliability (Features 7, 8, 9, 11)

### 7. Multi-tenant isolation audit
- Audit script (one-time SQL query) verifies every public table has `user_id` and an RLS policy scoped to `auth.uid()` or `has_role('admin')`.
- Fix any gaps found. Add `tenant_id` synonym view only if needed.

### 8. Safe migrations & backward compatibility
- Adopt convention: every migration is additive (new columns nullable with defaults; never DROP without two-step deprecation).
- Add `schema_version` row in `app_settings` bumped per migration for app-side compat checks.
- Document rollback note: Lovable Cloud snapshots are the rollback mechanism.

### 9. Performance & queue
- **New table `job_queue`**: `id`, `user_id`, `type`, `payload jsonb`, `status` (pending/processing/done/failed), `attempts`, `max_attempts` (default 3), `run_at`, `last_error`, timestamps. Indexed on `(status, run_at)`.
- **New edge function `process-jobs`**: picks ≤25 pending jobs, marks processing, executes by type (ai_reply, send_dm, scheduled_message, comment_trigger_dm), retries with exponential backoff.
- `pg_cron` runs `process-jobs` every minute.
- **Rate limit**: per-user counter in `job_queue` (max N jobs/minute) → enforced in webhook before enqueue.
- **Indexes added**: `messages(conversation_id, created_at)`, `ai_usage(user_id, created_at)`, `orders(user_id, created_at)`, `conversations(user_id, last_message_at DESC)`, `comment_trigger_logs(fb_comment_id)`.
- **Caching**: React Query `staleTime` tuning on dashboards (30s) to cut DB load.

### 11. Reliability
- Wrap all edge function handlers in try/catch → insert into `webhook_failures` on error.
- `job_queue` retry logic = automatic retries.
- Cron job `requeue-stuck-jobs` every 5min: jobs stuck in `processing` >10min → reset to pending.
- Admin "System Health" card shows recent failures.

---

## Technical details (for reference)

**New tables** (7): `comment_triggers`, `comment_trigger_logs`, `notifications`, `webhook_failures`, `job_queue`. Each with full RLS + GRANTs per project convention.

**New edge functions** (2): `send-fb-message`, `process-jobs`.

**Modified edge functions**: `fb-webhook` (comments handler, image toggle, failure logging, job enqueue, read/delivery events).

**Modified tables**: `bot_settings` (+`enable_image_analysis`), `messages` (+`read_at`, +`delivered_at`), `ai_usage` (+`tokens_used` if missing), `app_settings` (+`schema_version` row).

**New UI tabs**: Comment Triggers, Image Inbox. **Modified UI**: AiUsageDashboard, AdminAnalytics, ConversationsView (reply composer + 24h warning), DashboardHeader (NotificationBell), BotSettings (image toggle).

**Realtime publications**: `notifications` only (kept narrow to avoid cross-tenant leak risk).

**Cron jobs**: `process-jobs` (every 1 min), `requeue-stuck-jobs` (every 5 min). Existing `send-scheduled` cron preserved.

---

## Build order
Phase 1 → Phase 2 → Phase 3 → Phase 4. Each phase is one migration + code changes, fully shippable independently so existing users never break mid-update.

## Out of scope (call out)
- Custom backup automation (use Cloud platform backups).
- Enterprise queue infra (Inngest/Redis) — not selected.
- Appointments as a distinct entity — using complaints/orders as the notification triggers per your direction.
