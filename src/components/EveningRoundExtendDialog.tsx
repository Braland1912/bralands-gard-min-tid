import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  PAYMENT_LABELS,
  type EveningRoundGuest,
} from "@/hooks/useEveningRoundGuests";
import { useEveningRound } from "@/hooks/useEveningRound";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: EveningRoundGuest | null;
  /** Datum man tittar på just nu, t.ex. dagens datum. Nytt avresedatum måste vara > detta. */
  viewDate: string;
  /** Anropas när förlängning är klar och en ny runda finns för viewDate. */
  onExtended?: (newRoundId: string) => void;
}

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const shiftIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const daysBetween = (a: string, b: string) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
};

const EveningRoundExtendDialog = ({ open, onOpenChange, guest, viewDate, onExtended }: Props) => {
  const today = todayLocal();
  const minDeparture = useMemo(() => shiftIso(viewDate, 1), [viewDate]);
  const [newDeparture, setNewDeparture] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // Säkerställ att en runda finns för viewDate (för att gästen ska dyka upp där)
  // Använd standardlogiken för att skapa runda om den saknas.
  const { data: viewRound } = useEveningRound(undefined, true, viewDate);

  useEffect(() => {
    if (open && guest) {
      // Default: en natt extra utöver tidigare avresedatum, men minst minDeparture
      const defaultDate =
        guest.departure_date >= minDeparture ? shiftIso(guest.departure_date, 1) : minDeparture;
      setNewDeparture(defaultDate);
      setPaymentNote("");
      setAmountTouched(false);
    }
  }, [open, guest, minDeparture]);

  const originalNights = guest ? Math.max(1, daysBetween(guest.arrival_date, guest.departure_date)) : 0;
  const extraNights =
    guest && newDeparture ? Math.max(0, daysBetween(guest.departure_date, newDeparture)) : 0;
  const pricePerNight =
    guest && guest.payment_amount && originalNights > 0 ? guest.payment_amount / originalNights : null;
  const suggestedAmount =
    pricePerNight !== null ? Math.round(pricePerNight * extraNights) : null;
  const newTotalNights = originalNights + extraNights;
  const currency = guest?.payment_currency ?? "SEK";

  // Synka föreslaget belopp in i fältet tills användaren börjat redigera
  useEffect(() => {
    if (!amountTouched) {
      setAmount(suggestedAmount !== null && extraNights > 0 ? String(suggestedAmount) : "");
    }
  }, [suggestedAmount, extraNights, amountTouched]);

  if (!guest) return null;

  const parsedAmount = (() => {
    const n = parseFloat(amount.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  })();

  const handleSave = async () => {
    if (!newDeparture || newDeparture <= guest.departure_date) {
      toast.error("Nytt avresedatum måste vara senare än nuvarande");
      return;
    }
    if (newDeparture <= viewDate) {
      toast.error("Nytt avresedatum måste vara efter visat datum");
      return;
    }
    if (amount.trim() !== "" && parsedAmount === null) {
      toast.error("Ogiltigt restbelopp");
      return;
    }
    setSaving(true);
    try {
      const trimmedNote = paymentNote.trim();
      const amountText =
        parsedAmount !== null
          ? `Restbelopp: ${parsedAmount} ${currency}`
          : "Restbelopp att fakturera";
      const baseLine = `Förlängd ${guest.departure_date} → ${newDeparture}. ${amountText}.`;
      const fullLine = trimmedNote ? `${baseLine} Notering: ${trimmedNote}` : baseLine;
      const newNotes = guest.notes ? `${guest.notes}\n${fullLine}` : fullLine;

      const { error } = await supabase
        .from("evening_round_guests")
        .update({
          departure_date: newDeparture,
          status: "here",
          // Nollställ betalning så den dyker upp som EJ BETALT med restbelopp att hantera
          payment_method: null,
          payment_amount: parsedAmount,
          payment_currency: parsedAmount !== null ? currency : null,
          payment_other_note: trimmedNote || null,
          notes: newNotes,
        })
        .eq("id", guest.id);

      if (error) throw error;

      toast.success("Gästen förlängd", {
        description:
          parsedAmount !== null
            ? `Nytt avresedatum: ${newDeparture}. Restbelopp: ${parsedAmount} ${currency}.`
            : `Nytt avresedatum: ${newDeparture}. Markerad som EJ BETALT.`,
      });

      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-extend-search"] });
      onOpenChange(false);
      if (viewRound?.id) onExtended?.(viewRound.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte förlänga gästen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus2 className="h-5 w-5" />
            Förläng gäst
          </DialogTitle>
          <DialogDescription>
            Förläng gästens vistelse så hen dyker upp i aktuell kvällsrunda igen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="font-semibold">
              {guest.place_label ? `Plats ${guest.place_label}` : "Ingen plats"}
              {guest.registration_number ? ` · ${guest.registration_number}` : ""}
            </div>
            <div className="text-muted-foreground">
              Nuvarande: {guest.arrival_date} → {guest.departure_date} ({originalNights} nätter)
            </div>
            <div className="text-muted-foreground">
              Tidigare betalning:{" "}
              {guest.payment_method && guest.payment_amount
                ? `${PAYMENT_LABELS[guest.payment_method]} · ${guest.payment_amount} ${guest.payment_currency ?? "SEK"}`
                : "—"}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-departure">Nytt avresedatum</Label>
            <Input
              id="new-departure"
              type="date"
              value={newDeparture}
              min={minDeparture}
              onChange={(e) => setNewDeparture(e.target.value)}
              className="input-datetime"
              placeholder="ÅÅÅÅ-MM-DD"
            />
            <p className="text-xs text-muted-foreground">
              Måste vara efter {viewDate === today ? "idag" : viewDate}.
            </p>
          </div>

          {extraNights > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3 text-sm">
              <div className="font-medium">
                Förlängning: +{extraNights} {extraNights === 1 ? "natt" : "nätter"} (totalt {newTotalNights})
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="extend-amount">Restbelopp ({currency})</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="extend-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="1"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setAmountTouched(true);
                    }}
                    placeholder={suggestedAmount !== null ? String(suggestedAmount) : "0"}
                  />
                  {amountTouched && suggestedAmount !== null && parsedAmount !== suggestedAmount && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAmount(String(suggestedAmount));
                        setAmountTouched(false);
                      }}
                    >
                      Återställ
                    </Button>
                  )}
                </div>
                {suggestedAmount !== null ? (
                  <p className="text-xs text-muted-foreground">
                    Förslag: {suggestedAmount} {currency} ({Math.round(pricePerNight!)} {currency}/natt × {extraNights}). Justera vid behov.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Inget pris per natt registrerat — fyll i belopp manuellt eller lämna tomt.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="extend-note">Betalningsnotering (valfri)</Label>
                <Textarea
                  id="extend-note"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="T.ex. ska Swisha imorgon, betalat 200 kontant…"
                  rows={2}
                />
              </div>

              <div className="text-xs text-muted-foreground">
                Kortet markeras som <span className="font-semibold">EJ BETALT</span> tills ny betalning registreras.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving || extraNights === 0}>
            {saving ? "Sparar…" : "Förläng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EveningRoundExtendDialog;
