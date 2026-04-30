import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EveningRoundSession {
  id: string;
  worker_id: string;
  round_date: string;
  session_start: string | null;
  session_end: string | null;
}

/**
 * Hanterar medarbetarens session för kvällsrundan – när de börjar/slutar gå rundan.
 */
export const useEveningRoundSession = (
  workerId: string | undefined,
  date: string,
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
    onSuccess: () => {
      toast.success("Rundan startad");
      queryClient.invalidateQueries({ queryKey: ["evening-round-session"] });
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
    onSuccess: () => {
      toast.success("Rundan avslutad");
      queryClient.invalidateQueries({ queryKey: ["evening-round-session"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte avsluta rundan"),
  });

  return { ...query, start, end };
};

/** Admin-vy: alla sessioner för ett datum. */
export const useEveningRoundSessionsForDate = (date: string, enabled: boolean) => {
  return useQuery({
    queryKey: ["evening-round-sessions-all", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evening_round_sessions")
        .select("*, workers(name)")
        .eq("round_date", date)
        .order("session_start", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<EveningRoundSession & { workers: { name: string } | null }>;
    },
    enabled,
  });
};
