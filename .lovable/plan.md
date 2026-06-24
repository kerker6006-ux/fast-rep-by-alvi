
# Page Sharing & Team Invites

Per-page team invites with two roles. Invites by email; on accept, a LeadPilot account is auto-created tied to that gmail. Invited people only see pages they were invited to.

## Roles

| Role | Sees on shared page | Can do on shared page |
|---|---|---|
| **Owner** | Everything | Everything: bot, training, products, billing, invite/remove anyone (full or moderator), disconnect page |
| **Full Access** | Everything | Everything **except disconnecting the page or removing the owner**. **Can invite & remove BOTH full-access members and moderators** on that page (just like an owner, minus disconnect). |
| **Moderator** | Only: Conversations, Orders, Appointments/Complaints, Notifications bell | Reply to chats, view/update orders & appointments. No bot settings, training, products, billing, analytics, invites, or disconnect. |

Removal rules: Owner can remove anyone. Full-access can remove full-access and moderators (cannot remove the owner). Moderators can remove nobody.

## Database (1 migration)

- `page_members(id, page_id, user_id, role enum['full','moderator'], invited_by, created_at)` — unique `(page_id, user_id)`
- `page_invites(id, page_id, email lower, role, token uuid, invited_by, status enum['pending','accepted','revoked','expired'], expires_at, accepted_at, accepted_by, created_at)` — unique pending `(page_id, email)` via partial index
- Security-definer helpers:
  - `user_page_role(_page_id)` → `'owner' | 'full' | 'moderator' | null`
  - `user_has_page_access(_page_id)` → bool
  - `user_can_manage_page(_page_id)` → bool (owner or full — for settings/products/training writes AND for inviting/removing)
- RLS rewritten on every page-scoped table (`fb_pages, conversations, messages, orders, complaints, products, services, bot_settings, auto_reply_rules, pending_products, product_suggestions, leads, comment_triggers, comment_trigger_logs, scheduled_messages, notifications, website_knowledge, training_suggestions`) to use these helpers. Reads = `user_has_page_access`. Sensitive writes (bot settings, training, products, services, auto-reply, website knowledge, scheduled messages, comment triggers) = `user_can_manage_page`. Chat/orders/complaints writes = `user_has_page_access`. Disconnect (delete on `fb_pages`) = owner only.
- `page_members` / `page_invites` RLS:
  - SELECT: any owner or member of the page.
  - INSERT / DELETE / UPDATE: `user_can_manage_page(page_id)` — i.e. owner OR full. (No role restriction; full can invite both roles.)
  - Owner row cannot be deleted from `page_members` (owner isn't stored there — owner derives from `fb_pages.user_id`).
- `notify_new_order` / `notify_new_complaint` triggers: fan out one `notifications` row to owner + every page member.

## Edge functions

- `invite-page-member` — verifies `user_can_manage_page`. gmail-only email. Creates `page_invites`, enqueues `page-invite` email.
- `accept-page-invite` — public, token-based. If gmail user doesn't exist, creates auth user via service role with random password and triggers password-reset email. Inserts `page_members`, marks invite accepted.
- `revoke-page-invite`, `remove-page-member` — verify `user_can_manage_page`; cannot target the owner.

## Email

- `page-invite.tsx` (transactional, registered in `registry.ts`). "X invited you to manage <Page> on LeadPilot as <Full Access | Moderator>" + Accept button.

## Frontend

- **Bot Settings → "Team & Access" card**: visible when `accessRole` is `owner` or `full`. Lists members + pending invites for active page. Invite dialog (gmail + role radio: Full Access / Moderator). Revoke & remove buttons. Owner row shown but not removable.
- **`ActivePageContext`**: pages = owned ∪ shared (via `page_members`), each tagged with `accessRole`.
- **`useAccessRole(pageId)`** hook.
- **Sidebar/routes**: when active page role = `moderator`, only Conversations, Orders, Appointments, Notifications. Other routes redirect to Conversations.
- **Write-gating in components**: hide destructive/edit UI when role !== required. RLS is the real enforcement.
- **`/accept-invite` page**: calls edge function, shows result, redirects to login. New users told to check email for password setup.
