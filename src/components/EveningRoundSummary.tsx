import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, Save, Square, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CASH_LABELS,
  CHECKLIST_LABELS,
  DEFAULT_CASH,
  DEFAULT_CHECKLIST,
  type CashBreakdown,
  type CashKey,
  type Checklist,
  type ChecklistKey,
  type EveningRoundSummary,
  useEveningRoundSummary,
} from "@/hooks/useEveningRoundSummary";
import { useEveningRoundSession } from "@/hooks/useEveningRoundSession";

interface Props {
  eveningRoundId: string | undefined;
  workerId: string | undefined;
  /** Datum för rundan (YYYY-MM-DD). Krävs för snabbstartknappen. */
  roundDate?: string;
  /** Visa snabbstartknappen (start/stopp av runda). Default: true för egna redovisningar. */
  showQuickStart?: boolean;
  /** Om admin redigerar någon annans redovisning – override worker_id. */
  overrideSummary?: EveningRoundSummary | null;
  /** Anropas när admin sparat en historisk redovisning. */
  onSaved?: () => void;
}

const useOnline = () => {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
};

const sumCash = (c: CashBreakdown) =>
  Object.values(c).reduce((a, b) => a + (Number(b) || 0), 0);

const EveningRoundSummaryForm = ({
  eveningRoundId,
  workerId,
  roundDate,
  showQuickStart = true,
  overrideSummary,
  onSaved,
}: Props) => {
  const online = useOnline();
  const summaryHook = useEveningRoundSummary(
    overrideSummary ? overrideSummary.evening_round_id : eveningRoundId,
    overrideSummary ? overrideSummary.worker_id : workerId,
  );
  const data = overrideSummary ?? summaryHook.data;
  const canShowQuickStart = showQuickStart && !overrideSummary && !!workerId && !!roundDate;
  const sessionHook = useEveningRoundSession(
    canShowQuickStart ? workerId : undefined,
    roundDate ?? "",
  );
  const session = sessionHook.data;
  const sessionRunning = !!session?.session_start && !session?.session_end;
  const sessionFinished = !!session?.session_start && !!session?.session_end;

  const [checklist, setChecklist] = useState<Checklist>(DEFAULT_CHECKLIST);
  const [cash, setCash] = useState<CashBreakdown>(DEFAULT_CASH);
  const [notes, setNotes] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  // Synka från server när data uppdateras (men inte när lokalt dirty)
  useEffect(() => {
    if (!data) return;
    if (dirty) return;
    setChecklist({ ...DEFAULT_CHECKLIST, ...(data.checklist ?? {}) });
    setCash({ ...DEFAULT_CASH, ...(data.cash_breakdown ?? {}) });
    setNotes(data.notes ?? "");
  }, [data, dirty]);

  const total = useMemo(() => sumCash(cash), [cash]);

  const toggleItem = (key: ChecklistKey) => {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
    setDirty(true);
  };

  const setCashField = (key: CashKey, value: string) => {
    const n = value === "" ? 0 : Number(value);
    setCash((c) => ({ ...c, [key]: Number.isFinite(n) ? n : 0 }));
    setDirty(true);
  };

  const onSave = async () => {
    if (!online) {
      toast.error("Du är offline", { description: "Anslut igen för att spara." });
      return;
    }
    try {
      await summaryHook.update.mutateAsync({
        checklist,
        cash_breakdown: cash,
        notes: notes.trim() ? notes.trim() : null,
      });
      setDirty(false);
      toast.success("Redovisning sparad");
      onSaved?.();
    } catch {
      // toast hanteras i hook
    }
  };

  const missingTarget = !eveningRoundId && !overrideSummary;
  if (missingTarget) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Ingen kvällsrunda finns för valt datum än.
      </div>
    );
  }

  if (!overrideSummary && !workerId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Du behöver vara kopplad till en medarbetare för att fylla i redovisning.
      </div>
    );
  }

  const saving = summaryHook.update.isPending || summaryHook.ensure.isPending;

  return (
    <div className="space-y-4">
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4" />
          Du är offline – ändringar sparas inte förrän du är online igen.
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Checklista</h2>
          <span className="text-xs text-muted-foreground">
            {Object.values(checklist).filter(Boolean).length} / {Object.keys(checklist).length} klart
          </span>
        </div>
        <ul className="space-y-2">
          {(Object.keys(CHECKLIST_LABELS) as ChecklistKey[]).map((key) => {
            const checked = checklist[key];
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => toggleItem(key)}
                  aria-pressed={checked}
                  className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-colors ${
                    checked
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-accent/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                    aria-hidden
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className="text-sm leading-snug">{CHECKLIST_LABELS[key]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Kassaredovisning</h2>
          <span className="text-sm font-medium tabular-nums">
            Totalt: {total.toLocaleString("sv-SE")} kr
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(CASH_LABELS) as CashKey[]).map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`cash-${key}`}>{CASH_LABELS[key]}</Label>
              <div className="relative">
                <Input
                  id={`cash-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  value={cash[key] === 0 ? "" : String(cash[key])}
                  placeholder="0"
                  onChange={(e) => setCashField(key, e.target.value)}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  kr
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="summary-notes">Anteckningar</Label>
          <Textarea
            id="summary-notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
            placeholder="T.ex. detaljer kring betalning, något ovanligt…"
            rows={4}
          />
        </div>
      </section>

      <div className="sticky bottom-20 md:bottom-4 z-10">
        <div className="rounded-2xl border border-border bg-card/95 backdrop-blur px-3 py-2 flex items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {dirty ? "Osparade ändringar" : "Allt sparat"}
          </div>
          <Button onClick={onSave} disabled={saving || !online || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara
          </Button>
        </div>
      </div>

      {data?.updated_at && (
        <p className="text-[11px] text-muted-foreground text-center">
          Senast uppdaterad{" "}
          {new Date(data.updated_at).toLocaleString("sv-SE", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      )}
    </div>
  );
};

export default EveningRoundSummaryForm;
