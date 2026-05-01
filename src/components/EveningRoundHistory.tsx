import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CURRENCIES,
  normalizeCashBreakdown,
  totalsByCurrency,
  type Currency,
  type EveningRoundSummary,
} from "@/hooks/useEveningRoundSummary";
import {
  useEveningRoundHistory,
  type EveningRoundSummaryWithMeta,
} from "@/hooks/useEveningRoundHistory";
import EveningRoundSummaryForm from "@/components/EveningRoundSummary";

const formatTotals = (totals: Record<Currency, number>) => {
  const parts = CURRENCIES.filter((c) => totals[c] > 0).map(
    (c) => `${totals[c].toLocaleString("sv-SE", { maximumFractionDigits: 2 })} ${c}`,
  );
  return parts.length > 0 ? parts.join(" + ") : "0 SEK";
};

const EveningRoundHistory = () => {
  const [workerId, setWorkerId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [editing, setEditing] = useState<EveningRoundSummaryWithMeta | null>(null);

  const { data: workers = [] } = useQuery({
    queryKey: ["history-workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filters = useMemo(
    () => ({
      workerId,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [workerId, fromDate, toDate],
  );

  const { data: history = [], isLoading } = useEveningRoundHistory(filters, true);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-semibold">Filter</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Medarbetare</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">Från datum</Label>
            <Input
              id="from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Till datum</Label>
            <Input
              id="to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold">Historik</h2>
          <span className="text-xs text-muted-foreground">{history.length} poster</span>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Inga redovisningar hittades med valda filter.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((row) => {
              const cash = normalizeCashBreakdown(row.cash_breakdown);
              const totals = totalsByCurrency(cash);
              const checks = Object.values(row.checklist).filter(Boolean).length;
              const totalChecks = Object.keys(row.checklist).length;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="w-full text-left px-4 sm:px-5 py-3 hover:bg-accent/40 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {row.round_date
                          ? new Date(row.round_date).toLocaleDateString("sv-SE", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Okänt datum"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.worker_name ?? "Okänd"} · Checklista {checks}/{totalChecks}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums">
                        {formatTotals(totals)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(row.updated_at).toLocaleDateString("sv-SE")}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera redovisning</DialogTitle>
            <DialogDescription>
              {editing?.worker_name ?? "Okänd"} ·{" "}
              {editing?.round_date
                ? new Date(editing.round_date).toLocaleDateString("sv-SE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EveningRoundSummaryForm
              eveningRoundId={editing.evening_round_id}
              workerId={editing.worker_id}
              overrideSummary={editing as EveningRoundSummary}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EveningRoundHistory;
