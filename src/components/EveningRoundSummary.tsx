import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, Plus, Save, Square, Trash2, Wifi, WifiOff } from "lucide-react";
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
  CHECKLIST_LABELS,
  CURRENCIES,
  DEFAULT_CASH,
  DEFAULT_CHECKLIST,
  categoryTotalsByCurrency,
  newCashEntry,
  totalsByCurrency,
  type CashBreakdown,
  type CashCategoryEntry,
  type CashKey,
  type Checklist,
  type ChecklistKey,
  type Currency,
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
  const [selectedCurrencies, setSelectedCurrencies] = useState<Currency[]>(["SEK"]);
  const [notes, setNotes] = useState<string>("");
  const [dirty, setDirty] = useState(false);

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
    // Härled valda valutor: explicit fält om finns, annars från befintliga rader
    const explicit = data.selected_currencies;
    if (explicit && Array.isArray(explicit) && explicit.length > 0) {
      setSelectedCurrencies(explicit);
    } else if (cb) {
      const used = new Set<Currency>();
      (Object.values(cb) as CashCategoryEntry[][]).forEach((entries) => {
        (entries ?? []).forEach((e) => {
          if (e?.currency) used.add(e.currency);
        });
      });
      setSelectedCurrencies(used.size > 0 ? Array.from(used) : ["SEK"]);
    }
    setNotes(data.notes ?? "");
  }, [data, dirty]);

  const totals = useMemo(() => totalsByCurrency(cash), [cash]);
  const activeCurrencies = selectedCurrencies.length > 0 ? selectedCurrencies : ["SEK" as Currency];

  const toggleItem = (key: ChecklistKey) => {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
    setDirty(true);
  };

  const toggleCurrency = (cur: Currency) => {
    setSelectedCurrencies((prev) => {
      const has = prev.includes(cur);
      if (has) {
        if (prev.length === 1) return prev;
        const next = prev.filter((c) => c !== cur);
        const fallback = next[0];
        // Flytta rader som använde valutan till första kvarvarande
        setCash((cash) => {
          const updated: CashBreakdown = { ...cash };
          (Object.keys(updated) as CashKey[]).forEach((key) => {
            updated[key] = updated[key].map((e) =>
              e.currency === cur ? { ...e, currency: fallback } : e,
            );
          });
          return updated;
        });
        return next;
      }
      return [...prev, cur];
    });
    setDirty(true);
  };

  const addCashRow = (catKey: CashKey) => {
    const fallback = activeCurrencies[0] ?? "SEK";
    setCash((c) => ({ ...c, [catKey]: [...c[catKey], newCashEntry(fallback)] }));
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

  const onSave = async () => {
    if (!online) {
      toast.error("Du är offline", { description: "Anslut igen för att spara." });
      return;
    }
    try {
      await summaryHook.update.mutateAsync({
        checklist,
        cash_breakdown: cash,
        selected_currencies: selectedCurrencies,
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

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Kassaredovisning</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Välj vilka valutor du behöver, fyll sedan i per kategori.
          </p>
        </div>

        {/* Valutaval */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Valutor
          </Label>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((cur) => {
              const checked = selectedCurrencies.includes(cur);
              return (
                <label
                  key={cur}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-accent/40"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleCurrency(cur)}
                    aria-label={cur}
                  />
                  <span className="text-sm font-medium">{cur}</span>
                </label>
              );
            })}
          </div>
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
                                {activeCurrencies.map((cur) => (
                                  <SelectItem key={cur} value={cur}>
                                    {cur}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`note-${rowId}`} className="text-xs">
                            Anteckning
                          </Label>
                          {useTextareaNotes ? (
                            <Textarea
                              id={`note-${rowId}`}
                              value={entry.notes}
                              onChange={(e) =>
                                updateCashField(key, rowId, "notes", e.target.value)
                              }
                              rows={2}
                            />
                          ) : (
                            <Input
                              id={`note-${rowId}`}
                              value={entry.notes}
                              onChange={(e) =>
                                updateCashField(key, rowId, "notes", e.target.value)
                              }
                            />
                          )}
                        </div>
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
            {activeCurrencies.map((cur) => (
              <div key={cur} className="text-sm">
                <span className="font-semibold tabular-nums">
                  {formatAmount(totals[cur])}
                </span>{" "}
                <span className="text-muted-foreground">{cur}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-border">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Grand Total
            </div>
            <div className="text-sm font-semibold tabular-nums break-words">
              {activeCurrencies
                .map((cur) => `${formatAmount(totals[cur])} ${cur}`)
                .join(" + ")}
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
