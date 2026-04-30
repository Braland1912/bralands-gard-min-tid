import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STANDARD_PLACES, validatePlaceLabel } from "@/lib/place-label";

export interface ExtraPlace {
  id: string;
  evening_round_id: string;
  label: string;
  created_at: string;
}

export const useEveningRoundExtraPlaces = (eveningRoundId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["evening-round-extra-places", eveningRoundId],
    queryFn: async () => {
      if (!eveningRoundId) return [] as ExtraPlace[];
      const { data, error } = await supabase
        .from("evening_round_extra_places")
        .select("*")
        .eq("evening_round_id", eveningRoundId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ExtraPlace[];
    },
    enabled: !!eveningRoundId,
  });

  useEffect(() => {
    if (!eveningRoundId) return;
    const channel = supabase
      .channel(`extra_places_${eveningRoundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evening_round_extra_places" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["evening-round-extra-places"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eveningRoundId, queryClient]);

  const addPlace = useMutation({
    mutationFn: async (label: string) => {
      if (!eveningRoundId) throw new Error("Saknar runda");
      const existing = [
        ...STANDARD_PLACES,
        ...(query.data ?? []).map((p) => p.label),
      ];
      const result = validatePlaceLabel(label, existing);
      if (result.ok === false) throw new Error(result.error);
      const value = result.value;
      const { data, error } = await supabase
        .from("evening_round_extra_places")
        .insert({ evening_round_id: eveningRoundId, label: value })
        .select("*")
        .single();
      if (error) {
        // Postgres unique violation
        if ((error as any).code === "23505") {
          throw new Error(`Platsen "${value}" finns redan`);
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Plats ${data.label} tillagd`);
      queryClient.invalidateQueries({ queryKey: ["evening-round-extra-places"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte lägga till plats"),
  });

  const deletePlace = useMutation({
    mutationFn: async (id: string) => {
      // Hitta platsen i cachen för att veta dess label
      const place = (query.data ?? []).find((p) => p.id === id);
      if (!place) throw new Error("Platsen hittades inte");

      // Blockera om det finns gäster/bokningar kopplade till platsen i samma runda
      const { data: linkedGuests, error: checkErr } = await supabase
        .from("evening_round_guests")
        .select("id, guest_name, status")
        .eq("evening_round_id", place.evening_round_id)
        .eq("place_label", place.label);
      if (checkErr) throw checkErr;

      if (linkedGuests && linkedGuests.length > 0) {
        const count = linkedGuests.length;
        const names = linkedGuests
          .map((g: any) => g.guest_name)
          .filter((n: string) => n && n.trim().length > 0);
        const namePart =
          names.length > 0
            ? ` (${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""})`
            : "";
        throw new Error(
          `Kan inte ta bort platsen "${place.label}" — ${count} ${
            count === 1 ? "bokning är" : "bokningar är"
          } kopplade${namePart}. Ta bort eller flytta ${
            count === 1 ? "bokningen" : "bokningarna"
          } först.`,
        );
      }

      const { error } = await supabase
        .from("evening_round_extra_places")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    // Optimistisk uppdatering: ta bort kortet direkt, rulla tillbaka vid fel
    onMutate: async (id: string) => {
      const queryKey = ["evening-round-extra-places", eveningRoundId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ExtraPlace[]>(queryKey);
      queryClient.setQueryData<ExtraPlace[]>(queryKey, (old) =>
        (old ?? []).filter((p) => p.id !== id),
      );
      return { previous };
    },
    onError: (e: any, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["evening-round-extra-places", eveningRoundId],
          context.previous,
        );
      }
      toast.error(e.message ?? "Kunde inte ta bort plats");
    },
    onSuccess: () => {
      toast.success("Plats borttagen");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["evening-round-extra-places"] });
    },
  });

  return { ...query, addPlace, deletePlace };
};
