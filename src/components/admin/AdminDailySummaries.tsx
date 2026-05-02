import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EveningRoundSummaryForm from "@/components/EveningRoundSummary";
import {
  CURRENCIES,
  normalizeCashBreakdown,
  totalsByCurrency,
  type Currency,
  type EveningRoundSummary,
} from "@/hooks/useEveningRoundSummary";
import { formatLocalDate } from "@/lib/date-format";

interface SummaryRow extends EveningRoundSummary {
  worker_name: string | null;
}

const formatTotals = (totals: Record<Currency, number>) => {
  const parts = CURRENCIES.filter((c) => totals[c] > 0).map(
    (c) => `${totals[c].toLocaleString("sv-SE", { maximumFractionDigits: 2 })} ${c}`,
  );
  return parts.length > 0 ? parts.join(" + ") : "0 SEK";
};

interface Props {
  roundDate: string;
  eveningRoundId: string | undefined;
}

/**
 * Adminvy: visa dagens redovisningar (en per medarbetare som har sparat något)
 * och låt admin öppna och redigera dem.
 */
const AdminDailySummaries = ({ roundDate, eveningRoundId }: Props) => {
  const [editing, setEditing] = useState<SummaryRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["evening-round-daily-summaries", roundDate, eveningRoundId],
    enabled: !!roundDate,
    queryFn: async (): Promise<SummaryRow[]> => {
      // Hitta alla rundor för datumet (kan finnas flera om olika medarbetare).
      const { data: rounds, error: rErr } = await supabase
        .from("evening_rounds")
        .select("id")
        .eq("round_date", roundDate);
      if (rErr) throw rErr;
      const roundIds = (rounds ?? []).map((r) => r.id as string);
      if (roundIds.length === 0) return [];

      const { data: summaries, error: sErr } = await supabase
        .from("evening_round_summaries")
        .select("*")
        .in("evening_round_id", roundIds)
        .order("updated_at", { ascending: false });
      if (sErr) throw sErr;
      const list = (summaries ?? []) as unknown as EveningRoundSummary[];
      if (list.length === 0) return [];

      const workerIds = Array.from(new Set(list.map((s) => s.worker_id)));
      const { data: workers } = await supabase
        .from("workers")
        .select("id,name")
        .in("id", workerIds);
      const nameById = new Map((workers ?? []).map((w: any) => [w.id, w.name as string]));
      return list.map((s) => ({ ...s, worker_name: nameById.get(s.worker_id) ?? null }));
    },
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Dagens redovisningar</h2>
            <p className="text-xs text-muted-foreground capitalize">
              {formatLocalDate(roundDate, "long")}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{rows.length} st</span>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Ingen medarbetare har påbörjat en redovisning för det här datumet än.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
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
                      <div className="text-sm font-semibold truncate">
                        {row.worker_name ?? "Okänd"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Checklista {checks}/{totalChecks}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">
                          {formatTotals(totals)}
                        </div>
                      </div>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera redovisning</DialogTitle>
            <DialogDescription>
              {editing?.worker_name ?? "Okänd"} ·{" "}
              {formatLocalDate(roundDate, "long")}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EveningRoundSummaryForm
              eveningRoundId={editing.evening_round_id}
              workerId={editing.worker_id}
              overrideSummary={editing}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDailySummaries;
