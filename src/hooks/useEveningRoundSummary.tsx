import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ChecklistKey =
  | "cool_boxes"
  | "drain_locks"
  | "dryer_service"
  | "dryer_laundry"
  | "laundry_check";

export type Checklist = Record<ChecklistKey, boolean>;

export type CashKey = "kiosk" | "ved" | "tvattmaskin" | "torktumlare" | "other";

export type Currency = "SEK" | "EUR" | "NOK";

export const CURRENCIES: Currency[] = ["SEK", "EUR", "NOK"];

export interface CashCategoryEntry {
  quantity: number;
  amount: number;
  currency: Currency;
  notes: string;
}

export type CashBreakdown = Record<CashKey, CashCategoryEntry>;

export interface EveningRoundSummary {
  id: string;
  evening_round_id: string;
  worker_id: string;
  checklist: Checklist;
  cash_breakdown: CashBreakdown;
  selected_currencies?: Currency[];
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_CHECKLIST: Checklist = {
  cool_boxes: false,
  drain_locks: false,
  dryer_service: false,
  dryer_laundry: false,
  laundry_check: false,
};

export const DEFAULT_CASH_ENTRY: CashCategoryEntry = {
  quantity: 0,
  amount: 0,
  currency: "SEK",
  notes: "",
};

export const DEFAULT_CASH: CashBreakdown = {
  kiosk: { ...DEFAULT_CASH_ENTRY },
  ved: { ...DEFAULT_CASH_ENTRY },
  tvattmaskin: { ...DEFAULT_CASH_ENTRY },
  torktumlare: { ...DEFAULT_CASH_ENTRY },
  other: { ...DEFAULT_CASH_ENTRY },
};

export const CHECKLIST_LABELS: Record<ChecklistKey, string> = {
  cool_boxes: "Torka av under båda kylarna i kiosken",
  drain_locks: "Plocka isär och rengör båda vattenlåsen i båda duscharna",
  dryer_service: "Töm vatten och filter i torktumlare servicehuset",
  dryer_laundry: "Töm filter i torktumlare tvättstugan",
  laundry_check: "Kolla tvättmaskin och torktumlare (torr tvätt)",
};

export const CASH_LABELS: Record<CashKey, string> = {
  kiosk: "Kiosk",
  ved: "Ved",
  tvattmaskin: "Tvättmaskin",
  torktumlare: "Torktumlare",
  other: "Övrigt",
};

/** Konvertera ev. gammal struktur (number per kategori) till ny. */
export const normalizeCashBreakdown = (raw: unknown): CashBreakdown => {
  const result: CashBreakdown = {
    kiosk: { ...DEFAULT_CASH_ENTRY },
    ved: { ...DEFAULT_CASH_ENTRY },
    tvattmaskin: { ...DEFAULT_CASH_ENTRY },
    torktumlare: { ...DEFAULT_CASH_ENTRY },
    other: { ...DEFAULT_CASH_ENTRY },
  };
  if (!raw || typeof raw !== "object") return result;
  const obj = raw as Record<string, unknown>;
  (Object.keys(result) as CashKey[]).forEach((key) => {
    const value = obj[key];
    if (typeof value === "number") {
      // Gammal form
      result[key] = { quantity: 1, amount: value, currency: "SEK", notes: "" };
    } else if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      const currency = (v.currency as Currency) ?? "SEK";
      result[key] = {
        quantity: Number(v.quantity) || 0,
        amount: Number(v.amount) || 0,
        currency: CURRENCIES.includes(currency) ? currency : "SEK",
        notes: typeof v.notes === "string" ? v.notes : "",
      };
    }
  });
  return result;
};

/** Subtotal för en kategori (quantity * amount). */
export const categorySubtotal = (entry: CashCategoryEntry) =>
  (Number(entry.quantity) || 0) * (Number(entry.amount) || 0);

/** Summera alla kategorier per valuta. */
export const totalsByCurrency = (cash: CashBreakdown): Record<Currency, number> => {
  const totals: Record<Currency, number> = { SEK: 0, EUR: 0, NOK: 0 };
  (Object.keys(cash) as CashKey[]).forEach((key) => {
    const entry = cash[key];
    totals[entry.currency] += categorySubtotal(entry);
  });
  return totals;
};

interface UpdatePayload {
  checklist?: Checklist;
  cash_breakdown?: CashBreakdown;
  selected_currencies?: Currency[];
  notes?: string | null;
}

/**
 * Hämtar (eller skapar) redovisning för aktuell medarbetare och kvällsrunda.
 */
export const useEveningRoundSummary = (
  eveningRoundId: string | undefined,
  workerId: string | undefined,
) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["evening-round-summary", eveningRoundId, workerId],
    queryFn: async (): Promise<EveningRoundSummary | null> => {
      if (!eveningRoundId || !workerId) return null;
      const { data, error } = await supabase
        .from("evening_round_summaries")
        .select("*")
        .eq("evening_round_id", eveningRoundId)
        .eq("worker_id", workerId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as EveningRoundSummary;
      return {
        ...row,
        cash_breakdown: normalizeCashBreakdown(row.cash_breakdown),
      };
    },
    enabled: !!eveningRoundId && !!workerId,
  });

  const ensure = useMutation({
    mutationFn: async (): Promise<EveningRoundSummary> => {
      if (!eveningRoundId || !workerId) throw new Error("Saknar runda eller medarbetare");
      const { data: existing } = await supabase
        .from("evening_round_summaries")
        .select("*")
        .eq("evening_round_id", eveningRoundId)
        .eq("worker_id", workerId)
        .maybeSingle();
      if (existing) {
        const row = existing as unknown as EveningRoundSummary;
        return { ...row, cash_breakdown: normalizeCashBreakdown(row.cash_breakdown) };
      }

      const { data, error } = await supabase
        .from("evening_round_summaries")
        .insert({
          evening_round_id: eveningRoundId,
          worker_id: workerId,
          created_by: workerId,
          updated_by: workerId,
          checklist: DEFAULT_CHECKLIST as never,
          cash_breakdown: DEFAULT_CASH as never,
        } as never)
        .select("*")
        .single();
      if (error) throw error;
      const row = data as unknown as EveningRoundSummary;
      return { ...row, cash_breakdown: normalizeCashBreakdown(row.cash_breakdown) };
    },
    onSuccess: (row) => {
      queryClient.setQueryData(
        ["evening-round-summary", eveningRoundId, workerId],
        row,
      );
    },
  });

  const update = useMutation({
    mutationFn: async (payload: UpdatePayload) => {
      if (!eveningRoundId || !workerId) throw new Error("Saknar runda eller medarbetare");
      let row = query.data;
      if (!row) {
        row = await ensure.mutateAsync();
      }
      const { data, error } = await supabase
        .from("evening_round_summaries")
        .update({ ...payload, updated_by: workerId } as never)
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = data as unknown as EveningRoundSummary;
      return { ...updated, cash_breakdown: normalizeCashBreakdown(updated.cash_breakdown) };
    },
    onSuccess: (row) => {
      queryClient.setQueryData(
        ["evening-round-summary", eveningRoundId, workerId],
        row,
      );
      queryClient.invalidateQueries({ queryKey: ["evening-round-summaries-history"] });
    },
    onError: (e: Error) => {
      toast.error("Kunde inte spara", { description: e.message });
    },
  });

  // Realtime
  useEffect(() => {
    if (!eveningRoundId) return;
    const channel = supabase
      .channel(`evening_round_summaries_${eveningRoundId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "evening_round_summaries",
          filter: `evening_round_id=eq.${eveningRoundId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["evening-round-summary", eveningRoundId, workerId],
          });
          queryClient.invalidateQueries({ queryKey: ["evening-round-summaries-history"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eveningRoundId, workerId, queryClient]);

  return { ...query, ensure, update };
};
