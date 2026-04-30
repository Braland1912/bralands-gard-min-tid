import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type GuestStatus = "here" | "checked_out" | "not_here";
export type PaymentMethod = "S" | "P" | "Cp" | "Cc" | "R" | "B" | "K" | "Z";
export type Currency = "SEK" | "EUR" | "NOK";

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
  payment_currency: Currency | null;
  status: GuestStatus;
  notes: string | null;
  nationality: string | null;
}

export interface GuestInput {
  place_number: number;
  guest_name: string;
  registration_number?: string | null;
  arrival_date: string;
  departure_date: string;
  payment_method?: PaymentMethod | null;
  payment_amount?: number | null;
  payment_currency?: Currency | null;
  status?: GuestStatus;
  notes?: string | null;
  nationality?: string | null;
}

const todayLocalIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const shiftIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** Returnerar t.ex. "Idag (29/4)", "Igår (28/4)", "Imorgon (30/4)" eller "12/5". */
export const formatDateLabel = (iso: string): string => {
  if (!iso) return "";
  const today = todayLocalIso();
  const [, m, d] = iso.split("-");
  const short = `${parseInt(d, 10)}/${parseInt(m, 10)}`;
  if (iso === today) return `Idag (${short})`;
  if (iso === shiftIso(today, -1)) return `Igår (${short})`;
  if (iso === shiftIso(today, 1)) return `Imorgon (${short})`;
  return short;
};

const buildDescription = (parts: Array<string | undefined | null>) =>
  parts.filter((p) => p && p.length > 0).join(" • ");


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
          notes: input.notes ?? null,
          nationality: input.nationality ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Gäst tillagd", {
        description: buildDescription([
          `Plats ${data.place_number}`,
          data.guest_name,
          formatDateLabel(date),
        ]),
      });
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
      return { data, patch };
    },
    onSuccess: ({ data, patch }) => {
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
      const keys = Object.keys(patch);
      const guestPart = data?.guest_name ? `Plats ${data.place_number} • ${data.guest_name}` : undefined;
      const datePart = formatDateLabel(date);
      if (keys.length === 1 && keys[0] === "status") {
        const labels: Record<string, string> = {
          here: "Markerad som Här",
          checked_out: "Markerad som Utcheckad",
          not_here: "Markerad som Inte här",
        };
        toast.success(labels[(patch as any).status] ?? "Status uppdaterad", {
          description: buildDescription([guestPart, datePart]),
        });
      } else {
        toast.success("Ändringar sparade", {
          description: buildDescription([guestPart, datePart]),
        });
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara ändringar"),
  });

  const deleteGuest = useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from("evening_round_guests")
        .select("place_number, guest_name")
        .eq("id", id)
        .maybeSingle();
      const { error } = await supabase.from("evening_round_guests").delete().eq("id", id);
      if (error) throw error;
      return existing;
    },
    onSuccess: (existing) => {
      toast.success("Gäst borttagen", {
        description: buildDescription([
          existing ? `Plats ${existing.place_number} • ${existing.guest_name}` : undefined,
          formatDateLabel(date),
          existing ? "platsen är nu ledig" : undefined,
        ]),
      });
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
