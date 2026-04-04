import { describe, expect, it } from "vitest";
import { mergeGeneratedSettings } from "@/lib/ai-training-settings";

describe("mergeGeneratedSettings", () => {
  it("keeps existing manual instructions and appends new wizard rules", () => {
    const merged = mergeGeneratedSettings(
      {
        ai_personality: "Always reply in Bangla\nMention delivery charge when needed",
        custom_instructions: "Never say the product is outside the collection",
      },
      {
        ai_personality: "Use a warm and polite tone",
        custom_instructions: "Ask for name, phone and address before confirming an order",
      },
    );

    expect(merged.ai_personality).toContain("Always reply in Bangla");
    expect(merged.ai_personality).toContain("Use a warm and polite tone");
    expect(merged.custom_instructions).toContain("Never say the product is outside the collection");
    expect(merged.custom_instructions).toContain("Ask for name, phone and address before confirming an order");
  });

  it("merges faq entries without dropping manual ones and lets newer duplicate answers win", () => {
    const merged = mergeGeneratedSettings(
      {
        faq_list: JSON.stringify([
          { q: "Price?", a: "300 tk" },
          { q: "Delivery?", a: "60 tk" },
        ]),
      },
      {
        faq_list: JSON.stringify([
          { q: "price?", a: "Starts from 300 tk" },
          { q: "Color?", a: "Available in black and cream" },
        ]),
      },
    );

    const faqs = JSON.parse(merged.faq_list) as Array<{ q: string; a: string }>;

    expect(faqs).toHaveLength(3);
    expect(faqs.find((item) => item.q.toLowerCase() === "price?")?.a).toBe("Starts from 300 tk");
    expect(faqs.find((item) => item.q === "Delivery?")?.a).toBe("60 tk");
  });
});