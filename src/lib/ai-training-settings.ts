export type SettingsMap = Record<string, string>;

type SettingsRow = {
  setting_key: string;
  setting_value: string;
};

type FaqItem = {
  q?: string;
  a?: string;
};

type ReplyExample = {
  customer?: string;
  reply?: string;
  category?: string;
};

const MERGEABLE_TEXT_KEYS = new Set([
  "ai_personality",
  "custom_instructions",
  "order_instructions",
  "image_instructions",
  "angry_customer_handling",
]);

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  // If it's an object (Gemini returned nested JSON by mistake), stringify it cleanly
  if (typeof value === "object") {
    try {
      const str = JSON.stringify(value, null, 2);
      // If it looks like a settings object (has bot_name key), it's wrong - return empty
      if (str.includes('"bot_name"') || str.includes('"business_name"')) return "";
      return str;
    } catch { return ""; }
  }
  const str = String(value ?? "").replace(/\r\n/g, "\n").trim();
  // Clean up if the value accidentally contains JSON wrapper
  if (str.startsWith("```json") || str.startsWith("```")) {
    return str.replace(/```json\n?|```/g, "").trim();
  }
  return str;
};

const parseArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const uniqueStrings = (items: string[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const normalized = normalizeText(item);
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

const mergeInstructionText = (existingValue: string | undefined, incomingValue: unknown) => {
  const existing = normalizeText(existingValue);
  const incoming = normalizeText(incomingValue);

  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing.toLowerCase() === incoming.toLowerCase()) return existing;

  return uniqueStrings([
    ...existing.split(/\n+/),
    ...incoming.split(/\n+/),
  ]).join("\n");
};

const mergeFaqList = (existingValue: string | undefined, incomingValue: unknown) => {
  const items = new Map<string, { q: string; a: string }>();

  for (const item of parseArray<FaqItem>(existingValue)) {
    const question = normalizeText(item?.q);
    if (!question) continue;

    items.set(question.toLowerCase(), {
      q: question,
      a: normalizeText(item?.a),
    });
  }

  for (const item of parseArray<FaqItem>(incomingValue)) {
    const question = normalizeText(item?.q);
    if (!question) continue;

    const key = question.toLowerCase();
    const previous = items.get(key);

    items.set(key, {
      q: question,
      a: normalizeText(item?.a) || previous?.a || "",
    });
  }

  return JSON.stringify(Array.from(items.values()));
};

const mergeNeverSayList = (existingValue: string | undefined, incomingValue: unknown) => {
  return JSON.stringify(
    uniqueStrings([
      ...parseArray<string>(existingValue),
      ...parseArray<string>(incomingValue),
    ]),
  );
};

const mergeReplyExamples = (existingValue: string | undefined, incomingValue: unknown) => {
  const items = new Map<string, { customer: string; reply: string; category: string }>();

  for (const item of parseArray<ReplyExample>(existingValue)) {
    const customer = normalizeText(item?.customer);
    const reply = normalizeText(item?.reply);
    const category = normalizeText(item?.category);
    const key = `${customer.toLowerCase()}__${reply.toLowerCase()}`;

    if (!customer && !reply) continue;

    items.set(key, { customer, reply, category });
  }

  for (const item of parseArray<ReplyExample>(incomingValue)) {
    const customer = normalizeText(item?.customer);
    const reply = normalizeText(item?.reply);
    const category = normalizeText(item?.category);
    const key = `${customer.toLowerCase()}__${reply.toLowerCase()}`;

    if (!customer && !reply) continue;

    items.set(key, { customer, reply, category });
  }

  return JSON.stringify(Array.from(items.values()));
};

export const parseSettingsJson = <T>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

export const buildSettingsMap = (rows: SettingsRow[] | null | undefined): SettingsMap => {
  return (rows ?? []).reduce<SettingsMap>((acc, row) => {
    if (!row.setting_key) return acc;

    acc[row.setting_key] = row.setting_value ?? "";
    return acc;
  }, {});
};

export const mergeGeneratedSettings = (
  currentSettings: SettingsMap,
  generatedSettings: Record<string, unknown>,
): SettingsMap => {
  const nextSettings: SettingsMap = { ...currentSettings };

  for (const [key, rawValue] of Object.entries(generatedSettings ?? {})) {
    const normalizedValue = normalizeText(rawValue);
    if (!normalizedValue && !["faq_list", "never_say_list", "reply_examples"].includes(key)) {
      continue;
    }

    if (key === "faq_list") {
      nextSettings[key] = mergeFaqList(currentSettings[key], rawValue);
      continue;
    }

    if (key === "never_say_list") {
      nextSettings[key] = mergeNeverSayList(currentSettings[key], rawValue);
      continue;
    }

    if (key === "reply_examples") {
      nextSettings[key] = mergeReplyExamples(currentSettings[key], rawValue);
      continue;
    }

    if (MERGEABLE_TEXT_KEYS.has(key)) {
      nextSettings[key] = mergeInstructionText(currentSettings[key], rawValue);
      continue;
    }

    nextSettings[key] = normalizedValue;
  }

  return nextSettings;
};