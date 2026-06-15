import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logEveningRoundActivity } from "@/hooks/useEveningRoundActivityLog";

export interface GuestsLogCtx {
  workerId?: string | null;
  workerName?: string | null;
}

export type GuestStatus = "here" | "not_here";
export type PaymentMethod = "S" | "P" | "Cp" | "Cc" | "R" | "B" | "K" | "Z" | "F" | "O";
export type Currency = "SEK" | "EUR" | "NOK";
export type AccommodationType = "vehicle" | "tent" | "temporary";
export type VehicleType = "car" | "mc" | "motorhome" | "caravan";

export interface EveningRoundGuest {
  id: string;
  evening_round_id: string;
  place_label: string | null;
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
  payment_other_note: string | null;
  accommodation_type: AccommodationType;
  is_prepaid: boolean;
  temp_description: string | null;
  vehicle_type: VehicleType | null;
  trailer_registration: string | null;
  has_electricity: boolean | null;
  tent_persons: number | null;
}

export interface GuestInput {
  place_label: string | null;
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
  payment_other_note?: string | null;
  accommodation_type?: AccommodationType;
  is_prepaid?: boolean;
  temp_description?: string | null;
  vehicle_type?: VehicleType | null;
  trailer_registration?: string | null;
  has_electricity?: boolean | null;
  tent_persons?: number | null;
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: "Bil",
  mc: "MC",
  motorhome: "Husbil",
  caravan: "Husvagn",
};


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
  logCtx?: GuestsLogCtx,
) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["evening-round-guests", date, isAdmin, eveningRoundId],
    queryFn: async () => {
      // Alla inloggade ser alla gäster för datumet (read-only för icke-admin).
      const { data, error } = await supabase
        .from("evening_round_guests")
        .select("*")
        .lte("arrival_date", date)
        .gt("departure_date", date)
        .order("place_label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EveningRoundGuest[];
    },
    enabled: true,
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
          place_label: input.place_label,
          guest_name: input.guest_name,
          registration_number: input.registration_number ?? null,
          arrival_date: input.arrival_date,
          departure_date: input.departure_date,
          payment_method: input.payment_method ?? null,
          payment_amount: input.payment_amount ?? null,
          payment_currency: input.payment_currency ?? null,
          status: input.status ?? "here",
          notes: input.notes ?? null,
          nationality: input.nationality ?? null,
          payment_other_note: input.payment_other_note ?? null,
          accommodation_type: input.accommodation_type ?? "vehicle",
          is_prepaid: input.is_prepaid ?? false,
          temp_description: input.temp_description ?? null,
          vehicle_type: input.vehicle_type ?? null,
          trailer_registration: input.trailer_registration ?? null,
          has_electricity: input.has_electricity ?? null,
          tent_persons: input.tent_persons ?? null,
        } as any)

        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Gäst tillagd", {
        description: buildDescription([
          `Plats ${data.place_label}`,
          data.guest_name,
          formatDateLabel(date),
        ]),
      });
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
      logEveningRoundActivity({
        round_date: date,
        evening_round_id: data.evening_round_id,
        worker_id: logCtx?.workerId ?? null,
        worker_name: logCtx?.workerName ?? null,
        entity_type: "guest",
        entity_id: data.id,
        action: "create",
        summary: `La till gäst ${data.guest_name}${data.place_label ? ` på plats ${data.place_label}` : ""}`,
        details: {
          guest_name: data.guest_name,
          place_label: data.place_label,
          accommodation_type: data.accommodation_type,
          is_prepaid: data.is_prepaid,
        },
      });
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
      const guestPart = data?.guest_name ? `Plats ${data.place_label} • ${data.guest_name}` : undefined;
      const datePart = formatDateLabel(date);
      let summaryText: string;
      if (keys.length === 1 && keys[0] === "status") {
        const labels: Record<string, string> = {
          here: "Markerad som På plats",
          not_here: "Markerad som Ej kommit",
        };
        toast.success(labels[(patch as any).status] ?? "Status uppdaterad", {
          description: buildDescription([guestPart, datePart]),
        });
        const statusLabels: Record<string, string> = {
          here: "På plats",
          not_here: "Ej kommit",
        };
        summaryText = `${data.guest_name}: ${statusLabels[(patch as any).status] ?? "status"}`;
      } else {
        toast.success("Ändringar sparade", {
          description: buildDescription([guestPart, datePart]),
        });
        summaryText = `Ändrade gäst ${data.guest_name} (${keys.join(", ")})`;
      }
      logEveningRoundActivity({
        round_date: date,
        evening_round_id: data.evening_round_id,
        worker_id: logCtx?.workerId ?? null,
        worker_name: logCtx?.workerName ?? null,
        entity_type: "guest",
        entity_id: data.id,
        action: "update",
        summary: summaryText,
        details: {
          guest_name: data.guest_name,
          place_label: data.place_label,
          changed_fields: keys,
          patch,
        },
      });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara ändringar"),
  });

  const deleteGuest = useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from("evening_round_guests")
        .select("id, evening_round_id, place_label, guest_name")
        .eq("id", id)
        .maybeSingle();
      const { error } = await supabase.from("evening_round_guests").delete().eq("id", id);
      if (error) throw error;
      return existing;
    },
    onSuccess: (existing) => {
      toast.success("Gäst borttagen", {
        description: buildDescription([
          existing ? `Plats ${existing.place_label} • ${existing.guest_name}` : undefined,
          formatDateLabel(date),
          existing ? "platsen är nu ledig" : undefined,
        ]),
      });
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
      if (existing) {
        logEveningRoundActivity({
          round_date: date,
          evening_round_id: existing.evening_round_id,
          worker_id: logCtx?.workerId ?? null,
          worker_name: logCtx?.workerName ?? null,
          entity_type: "guest",
          entity_id: existing.id,
          action: "delete",
          summary: `Tog bort gäst ${existing.guest_name}${existing.place_label ? ` (plats ${existing.place_label})` : ""}`,
          details: {
            guest_name: existing.guest_name,
            place_label: existing.place_label,
          },
        });
      }
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
  Z: "Kortläsare",
  F: "Frikort",
  O: "Övrigt",
};
