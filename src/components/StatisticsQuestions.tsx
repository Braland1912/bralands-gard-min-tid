import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare, Send, Loader2, Trash2, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = { role: "user" | "assistant"; content: string };

export function StatisticsQuestions({ isAdmin }: { isAdmin: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const ask = async () => {
    const text = question.trim();
    if (!text || loading) return;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    try {
      const { data, error: requestError } = await supabase.functions.invoke("stats-report", {
        body: {
          action: "question", question: text, history: messages.slice(-12),
          ...(!isAdmin ? { password: sessionStorage.getItem("stats_pw") } : {}),
        },
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (requestError) {
        const response = requestError.context;
        const details = response instanceof Response ? await response.json().catch(() => null) : null;
        throw new Error(details?.error || "Kunde inte hämta svaret. Din fråga finns kvar så att du kan försöka igen.");
      }
      if (typeof data?.answer !== "string" || !data.answer.trim()) throw new Error("Inget svar kom tillbaka. Försök igen.");
      setMessages((previous) => [...previous, { role: "user", content: text }, { role: "assistant", content: data.answer }]);
      setQuestion("");
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Kunde inte hämta svaret.");
    } finally {
      setLoading(false);
      controller.current = null;
    }
  };

  return (
    <section className="border-y border-border py-5 space-y-4" aria-labelledby="statistics-questions-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="statistics-questions-title" className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Fråga om statistiken
        </h2>
        {messages.length > 0 && <Button variant="ghost" size="icon" title="Ny konversation" aria-label="Ny konversation" disabled={loading} onClick={() => { setMessages([]); setError(""); }}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      {messages.length > 0 && <div className="space-y-5 max-h-[600px] overflow-y-auto" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">{message.role === "user" ? "Din fråga" : "Svar"}</p>
            {message.role === "user" ? <p className="text-sm font-medium whitespace-pre-wrap break-words">{message.content}</p> :
              <div className="text-sm leading-relaxed break-words space-y-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  table: ({ children }) => <div className="overflow-x-auto"><table className="w-full text-sm border-collapse">{children}</table></div>,
                  th: ({ children }) => <th className="border-b border-border p-2 text-left font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border-b border-border p-2 align-top">{children}</td>,
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                  h1: ({ children }) => <h3 className="font-semibold text-base">{children}</h3>,
                  h2: ({ children }) => <h3 className="font-semibold text-base">{children}</h3>,
                  h3: ({ children }) => <h3 className="font-semibold">{children}</h3>,
                }}>{message.content}</ReactMarkdown>
              </div>}
          </div>
        ))}
      </div>}
      <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="space-y-3">
        <Textarea aria-label="Din fråga om statistiken" placeholder="Vad vill du veta?" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={4000} disabled={loading} rows={3} className="resize-y" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">AI-svar · Kontrollera viktiga siffror mot tabellerna.</p>
          {loading ? <Button type="button" variant="outline" onClick={() => controller.current?.abort()} className="gap-2"><Loader2 className="h-4 w-4 animate-spin" /><Square className="h-3 w-3" /> Avbryt</Button> :
            <Button type="submit" disabled={!question.trim()} className="gap-2"><Send className="h-4 w-4" /> Fråga</Button>}
        </div>
      </form>
    </section>
  );
}