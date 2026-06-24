/**
 * Moderator-allowed tab ids on a shared page.
 * Owners and Full Access see everything; moderators are strictly limited.
 */
export const MODERATOR_ALLOWED_TABS = new Set<string>([
  "conversations",
  "orders",
  "leads",
  "complaints",
  "analytics", // read-only overview only
]);

export const isTabAllowedForRole = (
  tabId: string,
  role: "owner" | "full" | "moderator" | null,
) => {
  if (!role || role === "owner" || role === "full") return true;
  return MODERATOR_ALLOWED_TABS.has(tabId);
};
