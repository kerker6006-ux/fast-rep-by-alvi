## Goal

Turn the dashboard into a per-page workspace. Each connected Facebook page is its own isolated business (inbox, AI training, products/services/courses, orders, complaints, settings, auto-replies, scheduled, comment triggers). Only **AI Usage** and **Credits** stay account-wide. Add a Content Creator category with course selling. Soft-delete pages (7-day grace). Make Welcome load instantly.

## 1. Welcome page — zero load

- Preload the Welcome route chunk (drop `lazy()` for `Welcome.tsx` so it ships in the auth bundle) and remove the spinner-blocking profile fetch.
- Stop blocking redirect on `profiles.onboarded_at`: read `onboarded_at` from the cached session/JWT user metadata that `handle_new_user` writes, so `ProtectedRoute` doesn't need a network round-trip before showing Welcome.
- Sort countries A→Z (already done) and render the `<select>` from a static module — no async.

## 2. Per-page category (locked on connect)

- New column `fb_pages.category` enum: `ecommerce | service | content_creator` (NOT NULL once set).
- Connection flow: after a page is added via `fb-connect-page`, show a one-time **Category dialog** that writes the category. Until then the page row exists but is `pending_category` and hidden from the switcher.
- Once set, the category is read-only in the UI. To change it, the user must disconnect and reconnect (matches the user's rule).

## 3. Top-of-app Page Switcher

- New `<PageSwitcher />` in `DashboardHeader` listing the user's active pages (avatar + name + category badge).
- Selected page id stored in a `useActivePage()` context, persisted to `localStorage`.
- All data hooks (`useConversations`, `useOrders`, `useComplaints`, `useProducts`, `useServices`, `useCourses`, `useAutoReplyRules`, `useScheduled`, `useCommentTriggers`, `useBotSettings`, AI Training fetches) gain a required `fb_page_id` filter.
- Sidebar items are rebuilt from the active page's **category**:
  - `ecommerce` → Products, Orders, Leads, Inbox, AI Training, Auto-reply, Scheduled, Comment Triggers, Settings
  - `service` → Services, Appointments (complaints/callbacks), Leads, Inbox, AI Training, Auto-reply, Scheduled, Comment Triggers, Settings
  - `content_creator` → **Courses**, **Enrollments**, Leads, Inbox, AI Training, Auto-reply, Scheduled, Comment Triggers, Settings (no Orders, no Complaints)
- Account-wide tabs stay above the page switcher: **AI Usage**, **Credits**.

## 4. Schema changes (one migration)

- `fb_pages`: add `category` (enum, nullable until first set), `pending_delete_at timestamptz`.
- Add `fb_page_id uuid` (nullable for back-compat, indexed) to: `products`, `services`, `orders`, `complaints`, `auto_reply_rules`, `bot_settings`, `scheduled_messages`, `comment_triggers`, `leads`, `training_suggestions`, `website_knowledge` if not already present. Conversations/messages already have it.
- New tables for creators:
  - `courses` (page-scoped: title, price, thumbnail_url, description, currency, is_active)
  - `course_lessons` (course_id, title, order_index, video_url, pdf_url, content)
  - `course_enrollments` (course_id, fb_user_id, customer_name, customer_phone, status, payment_status, granted_at)
  - All with `fb_page_id`, `user_id`, RLS by `auth.uid()`, GRANTs to authenticated + service_role.
- RLS on every per-page table also checks the page belongs to the user.

## 5. Disconnect = 7-day soft delete + confirm dialog

- "Disconnect" button opens a confirm dialog: "All conversations, orders, and data for this page will be hidden and permanently deleted after 7 days. Reconnect within 7 days to restore everything. Continue?"
- `fb-disconnect-page` edge function sets `is_active=false`, `subscription_status='disconnected'`, `disconnected_at=now()`, `pending_delete_at=now()+7 days`, clears `page_access_token`, unsubscribes from FB. Keeps all related rows.
- `fb-connect-page` (reconnect): if a row with same `fb_page_id` and `pending_delete_at > now()` exists, clear `pending_delete_at`, restore `is_active=true`, reuse the same row → history reappears automatically.
- New scheduled edge function `purge-disconnected-pages` (cron daily): hard-deletes pages with `pending_delete_at < now()` and cascades all per-page data.
- Page switcher and all queries filter `is_active = true AND pending_delete_at IS NULL OR pending_delete_at > now() AND status='active'`. Disconnected pages disappear from the switcher immediately.

## 6. Course-selling for content creators

- **Courses manager** UI (CRUD): title, thumbnail upload (product-images bucket), price, currency, description, lesson list.
- **Lessons**: video URL (YouTube/Vimeo/MP4) or PDF link; ordered.
- **Enrollments view**: list of buyers per course with payment status; manual "Mark paid + send access" button.
- **Bot behavior** (content_creator pages): when intent = "buy course", bot sends thumbnail + price + payment instruction. On "paid" confirmation (manual mark or keyword), `send-fb-message` DMs the lesson access links in order. No order/appointment extraction runs.
- AI Training presets get a `content_creator` persona variant ("course instructor, friendly, sends lesson links after payment").

## 7. Admin panel

- `AdminUsers` detail already shows pages, country, balance. Add: per-page category badge and `pending_delete_at` so admins see soft-deleted pages.

## Technical details

- Files added: `src/contexts/ActivePageContext.tsx`, `src/components/PageSwitcher.tsx`, `src/components/PageCategoryDialog.tsx`, `src/components/CoursesManager.tsx`, `src/components/EnrollmentsManager.tsx`, `src/hooks/useActivePage.ts`, `src/hooks/useCourses.ts`, `src/hooks/useEnrollments.ts`, `supabase/functions/purge-disconnected-pages/index.ts`.
- Files edited: `App.tsx` (preload Welcome), `ProtectedRoute.tsx` (no profile fetch), `DashboardHeader.tsx` (switcher), `DashboardSidebar.tsx` (category-driven items), `Index.tsx` (category-driven tab map), `FbPageConnection.tsx` (category dialog + 7-day disconnect dialog), all per-page hooks (filter by active page), `fb-disconnect-page/index.ts`, `fb-connect-page/index.ts`, `send-fb-message`/intent logic for course flow.
- One migration adds enum, `fb_pages.category`, `fb_pages.pending_delete_at`, `fb_page_id` columns on legacy tables, three course tables with RLS + GRANTs, and a cron schedule for `purge-disconnected-pages`.
- Existing data backfill: any row missing `fb_page_id` is assigned to the user's first active page (one-shot UPDATE in the migration).

## Out of scope (this plan)

- Building a full payment processor for courses — uses manual "mark paid" first. Stripe checkout for courses can be a follow-up.
- Changing AI Usage / Credits scope (stays account-wide per your instruction).
