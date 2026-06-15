import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logEveningRoundActivity } from "@/hooks/useEveningRoundActivityLog";

export interface EveningRoundSession {
  id: string;
  worker_id: string;
  round_date: string;
  session_start: string | null;
  session_end: string | null;
}

export interface SessionLogCtx {
  workerName?: string | null;
  eveningRoundId?: string | null;
}

/**
 * Hanterar medarbetarens session för kvällsrundan – när de börjar/slutar gå rundan.
 */
export const useEveningRoundSession = (
  workerId: string | undefined,
  date: string,
  logCtx?: SessionLogCtx,
) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["evening-round-session", workerId, date],
    queryFn: async () => {
      if (!workerId) return null;
      const { data, error } = await supabase
        .from("evening_round_sessions")
        .select("*")
        .eq("worker_id", workerId)
        .eq("round_date", date)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EveningRoundSession | null;
    },
    enabled: !!workerId,
  });

  useEffect(() => {
    const channel = supabase
      .channel("evening_round_sessions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evening_round_sessions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["evening-round-session"] });
          queryClient.invalidateQueries({ queryKey: ["evening-round-sessions-all"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const start = useMutation({
    mutationFn: async () => {
      if (!workerId) throw new Error("Saknar medarbetare");
      const now = new Date().toISOString();
      const existing = query.data;
      if (existing) {
        const { data, error } = await supabase
          .from("evening_round_sessions")
          .update({ session_start: now, session_end: null })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("evening_round_sessions")
        .insert({ worker_id: workerId, round_date: date, session_start: now })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Rundan startad");
      queryClient.invalidateQueries({ queryKey: ["evening-round-session"] });
      logEveningRoundActivity({
        round_date: date,
        evening_round_id: logCtx?.eveningRoundId ?? null,
        worker_id: workerId ?? null,
        worker_name: logCtx?.workerName ?? null,
        entity_type: "session",
        entity_id: (data as any)?.id ?? null,
        action: "start",
        summary: "Startade kvällsrundan",
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte starta rundan"),
  });

  const end = useMutation({
    mutationFn: async () => {
      if (!workerId) throw new Error("Saknar medarbetare");
      const existing = query.data;
      if (!existing) throw new Error("Ingen pågående runda");
      const { data, error } = await supabase
        .from("evening_round_sessions")
        .update({ session_end: new Date().toISOString() })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Rundan avslutad");
      queryClient.invalidateQueries({ queryKey: ["evening-round-session"] });
      logEveningRoundActivity({
        round_date: date,
        evening_round_id: logCtx?.eveningRoundId ?? null,
        worker_id: workerId ?? null,
        worker_name: logCtx?.workerName ?? null,
        entity_type: "session",
        entity_id: (data as any)?.id ?? null,
        action: "end",
        summary: "Avslutade kvällsrundan",
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte avsluta rundan"),
  });

  return { ...query, start, end };
};

/** Alla sessioner för ett datum (alla inloggade kan läsa). */
export const useEveningRoundSessionsForDate = (date: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["evening-round-sessions-all", date],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from("evening_round_sessions")
        .select("*")
        .eq("round_date", date)
        .order("session_start", { ascending: true });
      if (error) throw error;
      const list = (sessions ?? []) as EveningRoundSession[];
      if (list.length === 0) return [] as Array<EveningRoundSession & { worker_name: string | null }>;
      const ids = Array.from(new Set(list.map((s) => s.worker_id)));
      const { data: workers } = await supabase
        .from("workers")
        .select("id, name")
        .in("id", ids);
      const nameById = new Map((workers ?? []).map((w: any) => [w.id, w.name]));
      return list.map((s) => ({ ...s, worker_name: nameById.get(s.worker_id) ?? null }));
    },
    enabled,
  });
};
