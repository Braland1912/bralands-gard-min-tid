import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EveningRoundSummary } from "@/hooks/useEveningRoundSummary";

export interface EveningRoundSummaryWithMeta extends EveningRoundSummary {
  worker_name: string | null;
  round_date: string | null;
}

interface Filters {
  workerId?: string | "all";
  fromDate?: string;
  toDate?: string;
}

/**
 * Historik över alla redovisningar (admin-vy).
 * Joinar workers + evening_rounds via två extra hämtningar.
 */
export const useEveningRoundHistory = (filters: Filters, enabled: boolean) => {
  return useQuery({
    queryKey: ["evening-round-summaries-history", filters],
    enabled,
    queryFn: async (): Promise<EveningRoundSummaryWithMeta[]> => {
      let q = supabase
        .from("evening_round_summaries")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);

      if (filters.workerId && filters.workerId !== "all") {
        q = q.eq("worker_id", filters.workerId);
      }

      const { data: rows, error } = await q;
      if (error) throw error;
      const summaries = (rows ?? []) as unknown as EveningRoundSummary[];
      if (summaries.length === 0) return [];

      const workerIds = Array.from(new Set(summaries.map((s) => s.worker_id)));
      const roundIds = Array.from(new Set(summaries.map((s) => s.evening_round_id)));

      const [workersRes, roundsRes] = await Promise.all([
        supabase.from("workers").select("id,name").in("id", workerIds),
        supabase.from("evening_rounds").select("id,round_date").in("id", roundIds),
      ]);

      const workerMap = new Map(
        (workersRes.data ?? []).map((w) => [w.id as string, w.name as string]),
      );
      const roundMap = new Map(
        (roundsRes.data ?? []).map((r) => [r.id as string, r.round_date as string]),
      );

      let merged: EveningRoundSummaryWithMeta[] = summaries.map((s) => ({
        ...s,
        worker_name: workerMap.get(s.worker_id) ?? null,
        round_date: roundMap.get(s.evening_round_id) ?? null,
      }));

      if (filters.fromDate) {
        merged = merged.filter((m) => (m.round_date ?? "") >= filters.fromDate!);
      }
      if (filters.toDate) {
        merged = merged.filter((m) => (m.round_date ?? "") <= filters.toDate!);
      }

      return merged;
    },
  });
};
