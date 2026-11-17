import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare, Send, Loader2, Plus, Square, RefreshCw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; updated_at: string; messages?: Message[] };

export function StatisticsQuestions({ isAdmin }: { isAdmin: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const request = async (body: Record<string, unknown>, signal?: AbortSignal) => {
    const { data, error: requestError } = await supabase.functions.invoke("stats-report", {
      body: { ...body, ...(!isAdmin ? { password: sessionStorage.getItem("stats_pw") } : {}) }, signal,
    });
    if (requestError) {
      const response = requestError.context;
      const details = response instanceof Response ? await response.json().catch(() => null) : null;
      throw new Error(details?.error || "Kunde inte hämta chatten. Försök igen.");
    }
    return data;
  };
  const loadConversations = async (more = false) => {
    setListLoading(true);
    try {
      const data = await request({ action: "conversations", offset: more ? conversations.length : 0 });
      setConversations((previous) => more ? [...previous, ...data.conversations.filter((chat: Conversation) => !previous.some((item) => item.id === chat.id))] : data.conversations);
      setHasMore(data.conversations.length === 30);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Kunde inte hämta sparade chattar.");
    } finally { setListLoading(false); }
  };
  useEffect(() => { void loadConversations(); return () => controller.current?.abort(); }, [isAdmin]);
  const openConversation = async (id: string) => {
    setOpening(true);
    setError("");
    try {
      const data = await request({ action: "conversation", conversationId: id });
      setActive(data.conversation);
      setMessages(data.conversation.messages);
      setQuestion("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Kunde inte öppna chatten."); }
    finally { setOpening(false); }
  };
  const ask = async () => {
    const text = question.trim();
    if (!text || loading) return;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    try {
      const data = await request({ action: "question", question: text, history: messages.slice(-12), ...(active ? { conversationId: active.id } : {}) }, abort.signal);
      if (abort.signal.aborted) return;
      if (typeof data?.answer !== "string" || !data.answer.trim()) throw new Error("Inget svar kom tillbaka. Försök igen.");
      if (!data.conversation) throw new Error("Svaret kunde inte sparas. Försök igen.");
      setActive(data.conversation);
      setMessages(data.conversation.messages);
      setConversations((previous) => [data.conversation, ...previous.filter((chat) => chat.id !== data.conversation.id)]);
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
        <Button variant="outline" size="sm" disabled={loading || opening} onClick={() => { setActive(null); setMessages([]); setQuestion(""); setError(""); }} className="gap-2 shrink-0"><Plus className="h-4 w-4" /> Ny chatt</Button>
      </div>
      <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-border pb-4 md:border-b-0 md:border-r md:pr-4" aria-label="Sparade chattar">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Sparade chattar · Gemensamma</h3>
          <Button variant="ghost" size="icon" aria-label="Uppdatera sparade chattar" title="Uppdatera sparade chattar" disabled={listLoading || loading || opening} onClick={() => void loadConversations()}><RefreshCw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} /></Button>
        </div>
        <div className="space-y-1 max-h-48 md:max-h-[600px] overflow-y-auto">
          {conversations.map((chat) => <Button key={chat.id} variant={active?.id === chat.id ? "secondary" : "ghost"} className="w-full h-auto min-h-12 justify-start text-left whitespace-normal px-3 py-2" disabled={loading || opening} onClick={() => void openConversation(chat.id)}>
            <span className="min-w-0"><span className="block text-sm break-words">{chat.title}</span><span className="block text-xs text-muted-foreground font-normal mt-1">{new Date(chat.updated_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}</span></span>
          </Button>)}
          {!listLoading && conversations.length === 0 && <p className="text-sm text-muted-foreground py-2">Inga sparade chattar ännu.</p>}
          {hasMore && <Button variant="ghost" size="sm" disabled={listLoading || loading || opening} onClick={() => void loadConversations(true)}>Visa fler</Button>}
        </div>
      </aside>
      <div className="min-w-0 space-y-4" aria-busy={loading || opening}>
      {active && <div className="flex items-start justify-between gap-3"><h3 className="text-base font-semibold break-words min-w-0">{active.title}</h3><span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0"><Check className="h-3 w-3" /> Sparad</span></div>}
      {opening && <p className="text-sm text-muted-foreground">Öppnar chatten…</p>}
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
        <Textarea aria-label="Din fråga om statistiken" placeholder="Vad vill du veta?" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={4000} disabled={loading || opening} rows={3} className="resize-y" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">AI-svar · Kontrollera viktiga siffror mot tabellerna.</p>
          {loading ? <Button type="button" variant="outline" onClick={() => controller.current?.abort()} className="gap-2"><Loader2 className="h-4 w-4 animate-spin" /><Square className="h-3 w-3" /> Avbryt</Button> :
            <Button type="submit" disabled={!question.trim() || opening} className="gap-2"><Send className="h-4 w-4" /> Fråga</Button>}
        </div>
      </form>
      </div>
      </div>
    </section>
  );
}