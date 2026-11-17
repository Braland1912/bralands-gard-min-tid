import type { QuestionMessage } from "./question-input.ts";

export function validConversationId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function conversationTitle(generated: string, question: string): string {
  const title = generated.replace(/[\r\n]+/g, " ").replace(/^[\s"'`#]+|[\s"'`]+$/g, "").trim();
  return (title || question.trim()).slice(0, 100);
}

export function appendConversation(messages: QuestionMessage[], question: string, answer: string): QuestionMessage[] {
  return [...messages, { role: "user", content: question }, { role: "assistant", content: answer }];
}