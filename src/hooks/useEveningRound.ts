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
      // 1) Finns någon runda för datumet redan? (oavsett ansvarig)
      const { data: anyExisting, error: anyErr } = await supabase
        .from("evening_rounds")
        .select("*")
        .eq("round_date", date)
        .order("created_at", { ascending: true })
        .limit(1);
      if (anyErr) throw anyErr;
      const firstExisting = anyExisting?.[0] ?? null;

      // 2) Om denna medarbetare har en egen runda, prioritera den
      if (workerId) {
        const own = anyExisting?.find((r) => r.assigned_worker_id === workerId);
        if (own) return own;
      }

      // 3) Annars returnera den befintliga rundan om den finns
      if (firstExisting) return firstExisting;

      // 4) Auto-skapa: tillåts för idag och framtida datum (inte historiska)
      const today = todayLocal();
      if (date < today) return null;

      // Behöver en ansvarig – arbetaren själv om inloggad, annars dagens
      // schemalagda kvällsrundsperson, annars vilken arbetare som helst.
      let ownerId = workerId ?? null;

      if (!ownerId) {
        // Försök hitta någon som är schemalagd som "evening_round" denna dag
        const { data: scheduled } = await supabase
          .from("schedules")
          .select("user_id")
          .eq("date", date)
          .eq("shift_type", "evening_round")
          .limit(1);
        const scheduledUserId = scheduled?.[0]?.user_id ?? null;
        if (scheduledUserId) {
          const { data: w } = await supabase
            .from("workers")
            .select("id")
            .eq("user_id", scheduledUserId)
            .maybeSingle();
          if (w?.id) ownerId = w.id;
        }
      }

      if (!ownerId) {
        // Sista utväg: ta första bästa arbetaren (admin kan ändra ansvarig sen)
        const { data: anyWorker } = await supabase
          .from("workers")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1);
        ownerId = anyWorker?.[0]?.id ?? null;
      }

      if (!ownerId) return null; // Inga arbetare alls i systemet

      const { data: created, error: insErr } = await supabase
        .from("evening_rounds")
        .insert({ assigned_worker_id: ownerId, round_date: date })
        .select("*")
        .single();
      if (insErr) {
        // Om någon hann skapa samtidigt: hämta den
        const { data: race } = await supabase
          .from("evening_rounds")
          .select("*")
          .eq("round_date", date)
          .order("created_at", { ascending: true })
          .limit(1);
        if (race?.[0]) return race[0];
        throw insErr;
      }
      return created;
    },
    // Aktivera alltid – även för admin utan worker-koppling
    enabled: true,
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
