import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returnerar en map: evening_round_id -> medarbetarens namn för ett valt datum.
 * Används för att visa vem som ägde rundan på gästkort.
 */
export const useRoundOwnersForDate = (date: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["round-owners", date],
    queryFn: async () => {
      const { data: rounds, error } = await supabase
        .from("evening_rounds")
        .select("id, assigned_worker_id")
        .eq("round_date", date);
      if (error) throw error;
      const list = rounds ?? [];
      if (list.length === 0) return new Map<string, string>();
      const ids = Array.from(new Set(list.map((r) => r.assigned_worker_id)));
      const { data: workers } = await supabase
        .from("workers")
        .select("id, name")
        .in("id", ids);
      const nameByWorker = new Map((workers ?? []).map((w: any) => [w.id, w.name as string]));
      return new Map(list.map((r) => [r.id, nameByWorker.get(r.assigned_worker_id) ?? ""]));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("evening_rounds_owners_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evening_rounds" },
        () => queryClient.invalidateQueries({ queryKey: ["round-owners"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};
