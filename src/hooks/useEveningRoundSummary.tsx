import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logEveningRoundActivity } from "@/hooks/useEveningRoundActivityLog";

/** Lega-nycklar för bakåtkompatibilitet med tidigare lagrade rader. */
export type LegacyChecklistKey =
  | "cool_boxes"
  | "drain_locks"
  | "dryer_service"
  | "dryer_laundry"
  | "laundry_check";

/** Checklist är nu dynamisk: nyckel = checklist_template_items.id (uuid),
 *  värde = avbockad. Lega-nycklar tolereras vid läsning av gamla rader. */
export type Checklist = Record<string, boolean>;

export type CashKey = "kiosk" | "ved" | "tvattmaskin" | "torktumlare" | "other";

export type Currency = "SEK" | "EUR" | "NOK";

export const CURRENCIES: Currency[] = ["SEK", "EUR", "NOK"];

export interface CashCategoryEntry {
  /** Stabilt id för UI (genereras klientside om saknas). */
  id?: string;
  quantity: number;
  amount: number;
  currency: Currency;
  notes: string;
}

/** En kategori innehåller en lista av rader. Tom lista = inget registrerat. */
export type CashBreakdown = Record<CashKey, CashCategoryEntry[]>;

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

/** Default: tom checklista. Items kommer dynamiskt från vald mall. */
export const DEFAULT_CHECKLIST: Checklist = {};

export const DEFAULT_CASH_ENTRY: CashCategoryEntry = {
  quantity: 0,
  amount: 0,
  currency: "SEK",
  notes: "",
};

/** Tom default: inga rader per kategori. */
export const DEFAULT_CASH: CashBreakdown = {
  kiosk: [],
  ved: [],
  tvattmaskin: [],
  torktumlare: [],
  other: [],
};

/** Lega-etiketter (för rader som lagrats med gamla nycklar innan mallen infördes). */
export const LEGACY_CHECKLIST_LABELS: Record<LegacyChecklistKey, string> = {
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

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `e_${Math.random().toString(36).slice(2)}_${Date.now()}`;

export const newCashEntry = (currency: Currency = "SEK"): CashCategoryEntry => ({
  id: makeId(),
  quantity: 0,
  amount: 0,
  currency,
  notes: "",
});

const parseEntry = (v: Record<string, unknown>): CashCategoryEntry => {
  const currency = (v.currency as Currency) ?? "SEK";
  return {
    id: typeof v.id === "string" ? v.id : makeId(),
    quantity: Number(v.quantity) || 0,
    amount: Number(v.amount) || 0,
    currency: CURRENCIES.includes(currency) ? currency : "SEK",
    notes: typeof v.notes === "string" ? v.notes : "",
  };
};

/**
 * Konvertera ev. gammal struktur till ny array-baserad form.
 * Stödjer:
 *  - number per kategori (äldsta formatet) => 1 rad SEK
 *  - enstaka object per kategori (mellanformat) => 1 rad
 *  - array av objects (nya formatet) => behålls
 */
export const normalizeCashBreakdown = (raw: unknown): CashBreakdown => {
  const result: CashBreakdown = {
    kiosk: [],
    ved: [],
    tvattmaskin: [],
    torktumlare: [],
    other: [],
  };
  if (!raw || typeof raw !== "object") return result;
  const obj = raw as Record<string, unknown>;
  (Object.keys(result) as CashKey[]).forEach((key) => {
    const value = obj[key];
    if (Array.isArray(value)) {
      result[key] = value
        .filter((v) => v && typeof v === "object")
        .map((v) => parseEntry(v as Record<string, unknown>));
    } else if (typeof value === "number") {
      result[key] = [
        { id: makeId(), quantity: 1, amount: value, currency: "SEK", notes: "" },
      ];
    } else if (value && typeof value === "object") {
      result[key] = [parseEntry(value as Record<string, unknown>)];
    }
  });
  return result;
};

/**
 * Subtotal för en rad: quantity * amount.
 * Om quantity saknas/är 0 (t.ex. kiosk/övrigt utan antalsfält) räknas amount direkt.
 */
export const entrySubtotal = (entry: CashCategoryEntry) => {
  const qty = Number(entry.quantity) || 0;
  const amt = Number(entry.amount) || 0;
  return (qty > 0 ? qty : 1) * amt;
};

/** Subtotal för en kategori (summa av alla rader, oavsett valuta). */
export const categorySubtotal = (entries: CashCategoryEntry[]) =>
  entries.reduce((sum, e) => sum + entrySubtotal(e), 0);

/** Subtotal för en kategori per valuta. */
export const categoryTotalsByCurrency = (
  entries: CashCategoryEntry[],
): Record<Currency, number> => {
  const totals: Record<Currency, number> = { SEK: 0, EUR: 0, NOK: 0 };
  entries.forEach((e) => {
    totals[e.currency] += entrySubtotal(e);
  });
  return totals;
};

/** Summera alla kategorier per valuta. */
export const totalsByCurrency = (cash: CashBreakdown): Record<Currency, number> => {
  const totals: Record<Currency, number> = { SEK: 0, EUR: 0, NOK: 0 };
  (Object.keys(cash) as CashKey[]).forEach((key) => {
    const sub = categoryTotalsByCurrency(cash[key] ?? []);
    CURRENCIES.forEach((c) => {
      totals[c] += sub[c];
    });
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
export interface SummaryLogCtx {
  workerName?: string | null;
  roundDate?: string;
}

export const useEveningRoundSummary = (
  eveningRoundId: string | undefined,
  workerId: string | undefined,
  logCtx?: SummaryLogCtx,
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

/* -------------------------------------------------------------------------- */
/*  Dynamisk checklista — hämtar items från en checklist_template (mall).     */
/*  Vald mall pekas ut av app_settings.evening_round_checklist_template_id    */
/* -------------------------------------------------------------------------- */

export interface EveningChecklistItem {
  id: string;
  text: string;
  sort_order: number;
}

export const EVENING_CHECKLIST_SETTING_KEY = "evening_round_checklist_template_id";

export const useEveningRoundChecklistItems = () => {
  return useQuery({
    queryKey: ["evening-round-checklist-items"],
    queryFn: async (): Promise<EveningChecklistItem[]> => {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", EVENING_CHECKLIST_SETTING_KEY)
        .maybeSingle();
      const raw = setting?.value as unknown;
      const id =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object" && "id" in (raw as Record<string, unknown>)
            ? String((raw as Record<string, unknown>).id)
            : null;
      if (!id) return [];
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("id, text, sort_order")
        .eq("template_id", id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EveningChecklistItem[];
    },
  });
};
