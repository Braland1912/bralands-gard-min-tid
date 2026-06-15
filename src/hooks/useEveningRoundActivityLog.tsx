import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityEntityType = "guest" | "place" | "summary" | "session";
export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "rename"
  | "start"
  | "end"
  | "checklist"
  | "cash"
  | "notes";

export interface EveningRoundActivityLog {
  id: string;
  round_date: string;
  evening_round_id: string | null;
  worker_id: string | null;
  worker_name: string | null;
  entity_type: ActivityEntityType;
  entity_id: string | null;
  action: ActivityAction;
  summary: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface LogInput {
  round_date: string;
  evening_round_id?: string | null;
  worker_id?: string | null;
  worker_name?: string | null;
  entity_type: ActivityEntityType;
  entity_id?: string | null;
  action: ActivityAction;
  summary: string;
  details?: Record<string, unknown> | null;
}

const db = supabase as any;

/**
 * Skriv en händelse till kvällsrundans aktivitetslogg.
 * Tystar fel – loggning ska aldrig blockera den faktiska åtgärden.
 */
export const logEveningRoundActivity = async (input: LogInput) => {
  try {
    await db.from("evening_round_activity_log").insert({
      round_date: input.round_date,
      evening_round_id: input.evening_round_id ?? null,
      worker_id: input.worker_id ?? null,
      worker_name: input.worker_name ?? null,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      action: input.action,
      summary: input.summary,
      details: input.details ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Kunde inte skriva aktivitetslogg", e);
  }
};

/**
 * Hämta loggen för ett datum. Endast admins har RLS-tillgång att läsa.
 */
export const useEveningRoundActivityLog = (date: string, enabled: boolean) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["evening-round-activity-log", date],
    queryFn: async (): Promise<EveningRoundActivityLog[]> => {
      const { data, error } = await db
        .from("evening_round_activity_log")
        .select("*")
        .eq("round_date", date)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as EveningRoundActivityLog[];
    },
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`evening_round_activity_log_${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evening_round_activity_log" },
        () => {
          qc.invalidateQueries({ queryKey: ["evening-round-activity-log", date] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [date, enabled, qc]);

  return query;
};
