import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateLabel, type EveningRoundGuest } from "@/hooks/useEveningRoundGuests";
import { findDuplicateGuests } from "@/lib/duplicate-guests";

interface Props {
  guests: EveningRoundGuest[];
  onDelete: (id: string) => void;
  /** Om komponenten används på admin-vyn där texten kan vara lite tydligare. */
  variant?: "worker" | "admin";
}

/**
 * Visar en varningsbanner högst upp i kvällsrundan när samma regnummer finns
 * både som förbetald och manuellt inlagd på samma ankomstdatum. Ger ett-klicks-
 * knapp för att radera den förbetalda dubbletten (som är den man nästan alltid
 * vill bort — den manuella innehåller betalning och anteckningar).
 */
const DuplicateGuestsAlert = ({ guests, onDelete, variant = "worker" }: Props) => {
  const groups = useMemo(() => findDuplicateGuests(guests), [guests]);
  const [open, setOpen] = useState(true);
  const [confirmGuest, setConfirmGuest] = useState<EveningRoundGuest | null>(null);

  if (groups.length === 0) return null;

  const totalPrepaid = groups.reduce((n, g) => n + g.prepaid.length, 0);

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-100 transition-colors"
      >
        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-900 leading-tight">
            {groups.length === 1
              ? "1 möjlig dubblett"
              : `${groups.length} möjliga dubbletter`}
          </div>
          <div className="text-[11px] text-amber-800/80 leading-tight truncate">
            {variant === "admin"
              ? "Samma regnummer inlagt både förbetalt och manuellt"
              : "Samma regnummer förbetalt och manuellt — radera den förbetalda"}
          </div>
        </div>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
          {totalPrepaid} förbetald{totalPrepaid === 1 ? "" : "a"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-amber-700 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {groups.map((group) => (
            <div
              key={`${group.arrivalDate}-${group.reg}`}
              className="rounded-lg border border-amber-200 bg-white overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-100/60 border-b border-amber-200">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-amber-950 truncate">
                    Regnr {group.reg}
                  </div>
                  <div className="text-[10px] text-amber-800/80">
                    Ankomst {formatDateLabel(group.arrivalDate)}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-amber-900">
                  {group.guests.length} poster
                </span>
              </div>
              <ul className="divide-y divide-amber-100">
                {group.guests.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 px-2.5 py-2">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                        g.is_prepaid
                          ? "bg-sky-100 text-sky-800 border border-sky-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {g.is_prepaid ? "Förbetald" : "Manuell"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">
                        {g.guest_name || "(Utan namn)"}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {g.place_label ? `Plats ${g.place_label}` : "Ingen plats"}
                        {g.payment_method ? ` · Betalning ${g.payment_method}` : ""}
                        {g.payment_amount ? ` ${g.payment_amount} ${g.payment_currency ?? ""}` : ""}
                      </div>
                    </div>
                    {g.is_prepaid && (
                      <button
                        type="button"
                        onClick={() => setConfirmGuest(g)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-1 hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Radera
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[10px] text-amber-800/80 px-1">
            Tips: Behåll den manuella (den har betalning och anteckningar) och
            radera den förbetalda. Är du osäker — kolla anteckningar först.
          </p>
        </div>
      )}

      <AlertDialog open={confirmGuest !== null} onOpenChange={(o) => !o && setConfirmGuest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera förbetald dubblett?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmGuest ? (
                <>
                  Detta tar bort den förbetalda posten för{" "}
                  <strong>{confirmGuest.guest_name || "(utan namn)"}</strong>{" "}
                  (regnr {confirmGuest.registration_number}). Den manuellt inlagda
                  gästen med betalning finns kvar. Åtgärden loggas i historiken.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmGuest) onDelete(confirmGuest.id);
                setConfirmGuest(null);
              }}
            >
              Radera förbetald
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default DuplicateGuestsAlert;
