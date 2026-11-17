import { describe, expect, it } from "vitest";
import { appendConversation, conversationTitle, validConversationId } from "../../supabase/functions/stats-report/conversation-input";

describe("saved statistics conversations", () => {
  it("keeps each question and AI answer when adding a follow-up", () => {
    const saved = appendConversation([], "Priser nästa säsong?", "395 kr med el.");
    expect(appendConversation(saved, "Och utan el?", "345 kr.")).toEqual([
      { role: "user", content: "Priser nästa säsong?" }, { role: "assistant", content: "395 kr med el." },
      { role: "user", content: "Och utan el?" }, { role: "assistant", content: "345 kr." },
    ]);
    expect(saved).toHaveLength(2);
  });
  it("gives every chat a readable automatic title", () => {
    expect(conversationTitle('"Prismodell för nästa säsong"', "Fråga")).toBe("Prismodell för nästa säsong");
    expect(conversationTitle("", "  Campingens priser  ")).toBe("Campingens priser");
  });
  it("rejects malformed conversation references", () => {
    expect(validConversationId("8f9bc126-20b8-4b9d-8842-3f8057d62b1a")).toBe(true);
    expect(validConversationId("other-table")).toBe(false);
    expect(validConversationId(null)).toBe(false);
  });
});