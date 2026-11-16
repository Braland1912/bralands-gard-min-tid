export type QuestionMessage = { role: "user" | "assistant"; content: string };

export function parseQuestionInput(body: Record<string, unknown>): { question: string; history: QuestionMessage[] } | null {
  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 4000) return null;
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 12) return null;
  const messages: QuestionMessage[] = [];
  for (const item of history) {
    if (!item || typeof item !== "object" || (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string" || !item.content.trim() || item.content.length > 16000) return null;
    messages.push({ role: item.role, content: item.content });
  }
  return { question: body.question.trim(), history: messages };
}