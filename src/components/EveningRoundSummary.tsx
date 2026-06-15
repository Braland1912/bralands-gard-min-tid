import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, Circle, Cloud, CloudOff, Loader2, Play, Plus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CASH_LABELS,
  CURRENCIES,
  DEFAULT_CASH,
  DEFAULT_CHECKLIST,
  LEGACY_CHECKLIST_LABELS,
  categoryTotalsByCurrency,
  newCashEntry,
  totalsByCurrency,
  useEveningRoundChecklistItems,
  type CashBreakdown,
  type CashCategoryEntry,
  type CashKey,
  type Checklist,
  type Currency,
  type EveningRoundSummary,
  type LegacyChecklistKey,
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
  /** Visa den fasta checklistan (servicehus, vattenlås m.m.). Default: true. */
  showChecklist?: boolean;
  /** Visa kassaredovisningen och anteckningar. Default: true. */
  showCashSection?: boolean;
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

const formatAmount = (n: number) =>
  n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });

const EveningRoundSummaryForm = ({
  eveningRoundId,
  workerId,
  roundDate,
  showQuickStart = true,
  showChecklist = true,
  showCashSection = true,
  overrideSummary,
  onSaved,
}: Props) => {
  const online = useOnline();
  const { data: workerProfile } = useWorker(workerId);
  const summaryHook = useEveningRoundSummary(
    overrideSummary ? overrideSummary.evening_round_id : eveningRoundId,
    overrideSummary ? overrideSummary.worker_id : workerId,
    { workerName: workerProfile?.name, roundDate },
  );
  const data = overrideSummary ?? summaryHook.data;
  const canShowQuickStart = showQuickStart && !overrideSummary && !!workerId && !!roundDate;
  const sessionHook = useEveningRoundSession(
    canShowQuickStart ? workerId : undefined,
    roundDate ?? "",
    { workerName: workerProfile?.name, eveningRoundId },
  );
  const session = sessionHook.data;
  const sessionRunning = !!session?.session_start && !session?.session_end;
  const sessionFinished = !!session?.session_start && !!session?.session_end;

  const [checklist, setChecklist] = useState<Checklist>(DEFAULT_CHECKLIST);
  const [cash, setCash] = useState<CashBreakdown>(DEFAULT_CASH);
  
  const [notes, setNotes] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  const { data: checklistItems = [] } = useEveningRoundChecklistItems();

  // Synka från server när data uppdateras (men inte när lokalt dirty)
  useEffect(() => {
    if (!data) return;
    if (dirty) return;
    setChecklist({ ...DEFAULT_CHECKLIST, ...(data.checklist ?? {}) });
    const cb = data.cash_breakdown ?? DEFAULT_CASH;
    setCash({
      kiosk: cb.kiosk ?? [],
      ved: cb.ved ?? [],
      tvattmaskin: cb.tvattmaskin ?? [],
      torktumlare: cb.torktumlare ?? [],
      other: cb.other ?? [],
    });
    setNotes(data.notes ?? "");
  }, [data, dirty]);

  const totals = useMemo(() => totalsByCurrency(cash), [cash]);

  const toggleItem = (key: string) => {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
    setDirty(true);
  };

  const addCashRow = (catKey: CashKey) => {
    setCash((c) => ({ ...c, [catKey]: [...c[catKey], newCashEntry("SEK")] }));
    setDirty(true);
  };

  const removeCashRow = (catKey: CashKey, rowId: string) => {
    setCash((c) => ({ ...c, [catKey]: c[catKey].filter((e) => e.id !== rowId) }));
    setDirty(true);
  };

  const updateCashField = <K extends keyof CashCategoryEntry>(
    catKey: CashKey,
    rowId: string,
    field: K,
    value: CashCategoryEntry[K],
  ) => {
    setCash((c) => ({
      ...c,
      [catKey]: c[catKey].map((e) => (e.id === rowId ? { ...e, [field]: value } : e)),
    }));
    setDirty(true);
  };

  const onSave = async (opts: { silent?: boolean } = {}) => {
    if (!online) {
      if (!opts.silent) {
        toast.error("Du är offline", { description: "Anslut igen för att spara." });
      }
      return;
    }
    try {
      const usedCurrencies = Array.from(
        new Set(
          (Object.values(cash) as CashCategoryEntry[][])
            .flat()
            .map((e) => e.currency),
        ),
      );
      await summaryHook.update.mutateAsync({
        checklist,
        cash_breakdown: cash,
        selected_currencies: usedCurrencies.length > 0 ? usedCurrencies : ["SEK"],
        notes: notes.trim() ? notes.trim() : null,
      });
      setDirty(false);
      if (!opts.silent) {
        toast.success("Redovisning sparad");
        onSaved?.();
      }
    } catch {
      // toast hanteras i hook
    }
  };

  // Autosave: debounce 800ms efter senaste ändring
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty) return;
    if (!online) return;
    if (!eveningRoundId || !workerId) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      onSave({ silent: true });
    }, 800);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist, cash, notes, dirty, online, eveningRoundId, workerId]);

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
          <CloudOff className="h-4 w-4" />
          Du är offline – ändringar sparas inte förrän du är online igen.
        </div>
      )}

      {canShowQuickStart && (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Snabbstart</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sessionRunning && session?.session_start
                ? `Pågår sedan ${new Date(session.session_start).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`
                : sessionFinished && session?.session_end
                  ? `Avslutad ${new Date(session.session_end).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`
                  : "Starta rundan innan du fyller i nedan."}
            </p>
          </div>
          {sessionRunning ? (
            <Button
              size="lg"
              variant="outline"
              onClick={() => sessionHook.end.mutate()}
              disabled={sessionHook.end.isPending}
              className="shrink-0"
            >
              {sessionHook.end.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stoppa
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => sessionHook.start.mutate()}
              disabled={sessionHook.start.isPending}
              className="shrink-0"
            >
              {sessionHook.start.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {sessionFinished ? "Starta om" : "Starta"}
            </Button>
          )}
        </section>
      )}

      {showChecklist && (() => {
        // Bygg renderingslista: aktiva items från mallen, plus ev. legacy-nycklar
        // som redan finns i sparad checklist (för att inte tappa historik).
        const itemEntries = checklistItems.map((it) => ({
          id: it.id,
          label: it.text,
        }));
        const knownIds = new Set(itemEntries.map((i) => i.id));
        const legacyEntries = (Object.keys(checklist) as string[])
          .filter((k) => !knownIds.has(k) && k in LEGACY_CHECKLIST_LABELS)
          .map((k) => ({
            id: k,
            label: LEGACY_CHECKLIST_LABELS[k as LegacyChecklistKey],
          }));
        const renderItems = [...itemEntries, ...legacyEntries];

        const total = renderItems.length;
        const done = renderItems.filter((i) => checklist[i.id]).length;
        const allDone = done === total && total > 0;
        const progress = total > 0 ? (done / total) * 100 : 0;
        return (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Checklista för kvällsrundan</h2>
              <span
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                  allDone
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {allDone && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {done} / {total}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={total}
            >
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${
                  allDone ? "bg-primary" : "bg-primary/70"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {renderItems.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Ingen checklista vald än. Be en admin koppla en mall under
              inställningar.
            </p>
          ) : (
          <ul className="space-y-2">
            {renderItems.map((item) => {
              const checked = !!checklist[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    aria-pressed={checked}
                    className={`group w-full text-left rounded-xl border p-4 min-h-[64px] flex items-center gap-3.5 transition-all active:scale-[0.99] ${
                      checked
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border bg-background hover:bg-accent/40 hover:border-border/80"
                    }`}
                  >
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 bg-card text-transparent group-hover:border-muted-foreground/50"
                      }`}
                      aria-hidden
                    >
                      {checked ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : (
                        <Circle className="h-3 w-3 opacity-0" />
                      )}
                    </span>
                    <span
                      className={`text-[15px] leading-snug transition-colors ${
                        checked
                          ? "text-foreground/70 line-through decoration-foreground/30"
                          : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          )}
        </section>
        );
      })()}

      {showCashSection && (
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Kassaredovisning</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Räkna kontanterna från brevlådan i kiosken och från servicehuset.
            Lägg även till om någon betalat dig kontant under passet (t.ex. för
            ved, tvätt eller kiosk).
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Obs:</span> Gästnätter
            redovisas inte här – det gör du under fliken <span className="font-medium text-foreground">Rundan</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Lägg till en rad per kategori och välj valuta per rad.
          </p>
        </div>

        {/* Per kategori */}
        <div className="space-y-3">
          {(Object.keys(CASH_LABELS) as CashKey[]).map((key) => {
            const entries = cash[key] ?? [];
            const subTotals = categoryTotalsByCurrency(entries);
            const subtotalLabel = CURRENCIES.filter((c) => subTotals[c] > 0)
              .map((c) => `${formatAmount(subTotals[c])} ${c}`)
              .join(" + ") || "—";
            return (
              <div
                key={key}
                className="rounded-xl border border-border bg-background p-3 sm:p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{CASH_LABELS[key]}</h3>
                  <span className="text-sm font-medium tabular-nums text-right break-words max-w-[60%]">
                    {subtotalLabel}
                  </span>
                </div>

                {entries.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Inga rader än. Lägg till en rad för att registrera belopp.
                  </p>
                )}

                <ul className="space-y-3">
                  {entries.map((entry, idx) => {
                    const rowId = entry.id ?? `${key}-${idx}`;
                    const showQuantity = key === "ved" || key === "tvattmaskin" || key === "torktumlare";
                    const useTextareaNotes = key === "kiosk" || key === "other";
                    return (
                      <li
                        key={rowId}
                        className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Rad {idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCashRow(key, rowId)}
                            className="h-8 px-2 text-muted-foreground hover:text-destructive"
                            aria-label="Ta bort rad"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {useTextareaNotes && (
                          <div className="space-y-1.5">
                            <Label htmlFor={`desc-${rowId}`} className="text-xs font-medium">
                              Beskrivning
                            </Label>
                            <Textarea
                              id={`desc-${rowId}`}
                              value={entry.notes}
                              onChange={(e) =>
                                updateCashField(key, rowId, "notes", e.target.value)
                              }
                              rows={3}
                              placeholder={
                                key === "kiosk"
                                  ? "T.ex. 2 glassar, öl & chips"
                                  : "T.ex. båt, kanot, bastu eller annat"
                              }
                              className="min-h-[80px] text-base leading-relaxed resize-y"
                            />
                          </div>
                        )}
                        <div
                          className={`grid gap-2 ${
                            showQuantity
                              ? "grid-cols-2 sm:grid-cols-3"
                              : "grid-cols-2"
                          }`}
                        >
                          {showQuantity && (
                            <div className="space-y-1.5">
                              <Label htmlFor={`qty-${rowId}`} className="text-xs">
                                Antal
                              </Label>
                              <Input
                                id={`qty-${rowId}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step="1"
                                value={entry.quantity === 0 ? "" : String(entry.quantity)}
                                placeholder="0"
                                onChange={(e) =>
                                  updateCashField(
                                    key,
                                    rowId,
                                    "quantity",
                                    e.target.value === "" ? 0 : Number(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label htmlFor={`amt-${rowId}`} className="text-xs">
                              Belopp
                            </Label>
                            <Input
                              id={`amt-${rowId}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              value={entry.amount === 0 ? "" : String(entry.amount)}
                              placeholder="0"
                              onChange={(e) =>
                                updateCashField(
                                  key,
                                  rowId,
                                  "amount",
                                  e.target.value === "" ? 0 : Number(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
                          <div
                            className={`space-y-1.5 ${
                              showQuantity ? "col-span-2 sm:col-span-1" : ""
                            }`}
                          >
                            <Label htmlFor={`cur-${rowId}`} className="text-xs">
                              Valuta
                            </Label>
                            <Select
                              value={entry.currency}
                              onValueChange={(v) =>
                                updateCashField(key, rowId, "currency", v as Currency)
                              }
                            >
                              <SelectTrigger id={`cur-${rowId}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCIES.map((cur) => (
                                  <SelectItem key={cur} value={cur}>
                                    {cur}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {!useTextareaNotes && (
                          <div className="space-y-1.5">
                            <Label htmlFor={`note-${rowId}`} className="text-xs">
                              Anteckning
                            </Label>
                            <Input
                              id={`note-${rowId}`}
                              value={entry.notes}
                              onChange={(e) =>
                                updateCashField(key, rowId, "notes", e.target.value)
                              }
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCashRow(key)}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Lägg till rad
                </Button>
              </div>
            );
          })}
        </div>

        {/* Totaler */}
        <div className="rounded-xl border border-border bg-muted/40 p-3 sm:p-4 space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total per valuta
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CURRENCIES.filter((cur) => totals[cur] > 0).length === 0 ? (
              <div className="text-sm text-muted-foreground">Inget registrerat än.</div>
            ) : (
              CURRENCIES.filter((cur) => totals[cur] > 0).map((cur) => (
                <div key={cur} className="text-sm">
                  <span className="font-semibold tabular-nums">
                    {formatAmount(totals[cur])}
                  </span>{" "}
                  <span className="text-muted-foreground">{cur}</span>
                </div>
              ))
            )}
          </div>
          <div className="pt-2 border-t border-border">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Grand Total
            </div>
            <div className="text-sm font-semibold tabular-nums break-words">
              {CURRENCIES.filter((cur) => totals[cur] > 0)
                .map((cur) => `${formatAmount(totals[cur])} ${cur}`)
                .join(" + ") || "—"}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="summary-notes">Övriga anteckningar</Label>
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
      )}

      <div className="sticky bottom-20 md:bottom-4 z-10 flex justify-center pointer-events-none">
        <div
          className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors ${
            !online
              ? "border-amber-300/60 bg-amber-50/95 text-amber-800"
              : saving || dirty
                ? "border-border bg-card/95 text-muted-foreground"
                : "border-primary/30 bg-primary/10 text-primary"
          }`}
          aria-live="polite"
        >
          {!online ? (
            <>
              <CloudOff className="h-3.5 w-3.5" />
              Offline – sparas när du är online igen
            </>
          ) : saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sparar…
            </>
          ) : dirty ? (
            <>
              <Cloud className="h-3.5 w-3.5" />
              Osparade ändringar
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Allt sparat
            </>
          )}
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
