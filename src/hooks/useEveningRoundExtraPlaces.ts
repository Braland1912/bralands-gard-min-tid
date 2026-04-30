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
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Ange ett namn på platsen");
      const { data, error } = await supabase
        .from("evening_round_extra_places")
        .insert({ evening_round_id: eveningRoundId, label: trimmed })
        .select("*")
        .single();
      if (error) throw error;
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
      const { error } = await supabase
        .from("evening_round_extra_places")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plats borttagen");
      queryClient.invalidateQueries({ queryKey: ["evening-round-extra-places"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte ta bort plats"),
  });

  return { ...query, addPlace, deletePlace };
};
