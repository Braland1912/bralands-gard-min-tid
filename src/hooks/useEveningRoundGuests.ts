import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type GuestStatus = "here" | "checked_out" | "not_here";
export type PaymentMethod = "S" | "P" | "Cp" | "Cc" | "R" | "B" | "K" | "Z";

export interface EveningRoundGuest {
  id: string;
  evening_round_id: string;
  place_number: number;
  guest_name: string;
  registration_number: string | null;
  arrival_date: string;
  departure_date: string;
  payment_method: PaymentMethod | null;
  payment_amount: number | null;
  status: GuestStatus;
}

export interface GuestInput {
  place_number: number;
  guest_name: string;
  registration_number?: string | null;
  arrival_date: string;
  departure_date: string;
  payment_method?: PaymentMethod | null;
  payment_amount?: number | null;
  status?: GuestStatus;
}

/**
 * Hämtar alla gäster vars [arrival, departure) inkluderar dagens datum,
 * för aktuell rundas plats. Admin ser alla rundor (RLS sköter resten).
 */
export const useEveningRoundGuests = (
  eveningRoundId: string | undefined,
  date: string,
  isAdmin: boolean,
) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["evening-round-guests", eveningRoundId, date, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("evening_round_guests")
        .select("*")
        .lte("arrival_date", date)
        .gt("departure_date", date)
        .order("place_number", { ascending: true });
      if (!isAdmin && eveningRoundId) {
        q = q.eq("evening_round_id", eveningRoundId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EveningRoundGuest[];
    },
    enabled: isAdmin || !!eveningRoundId,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("evening_round_guests_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evening_round_guests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const addGuest = useMutation({
    mutationFn: async (input: GuestInput) => {
      if (!eveningRoundId) throw new Error("Saknar runda");
      const { data, error } = await supabase
        .from("evening_round_guests")
        .insert({
          evening_round_id: eveningRoundId,
          place_number: input.place_number,
          guest_name: input.guest_name,
          registration_number: input.registration_number ?? null,
          arrival_date: input.arrival_date,
          departure_date: input.departure_date,
          payment_method: input.payment_method ?? null,
          payment_amount: input.payment_amount ?? null,
          status: input.status ?? "here",
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Gäst tillagd");
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte lägga till gäst"),
  });

  const updateGuest = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<EveningRoundGuest> & { id: string }) => {
      const { data, error } = await supabase
        .from("evening_round_guests")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara ändringar"),
  });

  const deleteGuest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evening_round_guests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gäst borttagen");
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte ta bort gäst"),
  });

  return { ...query, addGuest, updateGuest, deleteGuest };
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  S: "Swish",
  P: "Paypal",
  Cp: "Campio",
  Cc: "Campcation",
  R: "Roadsurfers",
  B: "Bank",
  K: "Kontant",
  Z: "Zettle",
};
