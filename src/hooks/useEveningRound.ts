import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Hämtar (eller skapar) dagens kvällsrunda för aktuell medarbetare.
 * Admin utan koppling till worker får null tillbaka och kan ändå se alla gäster i useEveningRoundGuests.
 */
export const useEveningRound = (
  workerId: string | undefined,
  isAdmin: boolean,
  selectedDate?: string,
) => {
  const queryClient = useQueryClient();
  const date = selectedDate ?? todayLocal();

  const query = useQuery({
    queryKey: ["evening-round", date, workerId, isAdmin],
    queryFn: async () => {
      if (!workerId) return null;

      // Försök hämta befintlig runda för idag och denna medarbetare
      const { data: existing, error: selErr } = await supabase
        .from("evening_rounds")
        .select("*")
        .eq("round_date", date)
        .eq("assigned_worker_id", workerId)
        .maybeSingle();

      if (selErr) throw selErr;
      if (existing) return existing;

      // Skapa om saknas (RLS tillåter både medarbetare för egen och admin)
      const { data: created, error: insErr } = await supabase
        .from("evening_rounds")
        .insert({ assigned_worker_id: workerId, round_date: date })
        .select("*")
        .single();
      if (insErr) throw insErr;
      return created;
    },
    enabled: !!workerId,
  });

  // Realtime: lyssna på rundor
  useEffect(() => {
    const channel = supabase
      .channel("evening_rounds_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evening_rounds" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["evening-round"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { ...query, date };
};
