import { useState } from "react";
import { Plus, X, UserCheck } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EveningRoundGuest, GuestInput } from "@/hooks/useEveningRoundGuests";

interface Props {
  placeLabel: string;
  date: string;
  onQuickReserve: (input: GuestInput) => Promise<unknown> | unknown;
  onOpenFull: (place: string) => void;
  /** Visas endast för egna extra-platser. Om satt går platsen att ta bort. */
  onRemoveExtraPlace?: () => void;
  /** Förbetalda gäster utan plats — kan matchas direkt här. */
  prepaidGuests?: EveningRoundGuest[];
  /** Matcha en förbetald gäst med denna plats. */
  onAssignPrepaid?: (guestId: string) => Promise<unknown> | unknown;
}

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const QuickReserveCard = ({ placeLabel, date, onQuickReserve, onOpenFull, onRemoveExtraPlace, prepaidGuests = [], onAssignPrepaid }: Props) => {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isExtra = !!onRemoveExtraPlace;

  const handleReserve = async () => {
    setSaving(true);
    try {
      await onQuickReserve({
        place_label: placeLabel,
        guest_name: "",
        arrival_date: date,
        departure_date: addDays(date, 1),
        status: "not_here",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    if (!onRemoveExtraPlace) return;
    onRemoveExtraPlace();
    setConfirmOpen(false);
  };

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-3 space-y-2 ${
        isExtra ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground truncate">
          Plats {placeLabel}
          {isExtra && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Extra
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
            Ledig
          </span>
          {isExtra && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label={`Ta bort platsen ${placeLabel}`}
              title="Ta bort platsen"
              className="h-6 w-6 rounded-full border border-border bg-card text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 flex items-center justify-center transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenFull(placeLabel)}
          className="flex-[1.6] rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-2.5 flex items-center justify-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Lägg till gäst
        </button>
        <button
          type="button"
          onClick={handleReserve}
          disabled={saving}
          className="flex-1 rounded-xl border border-border bg-card text-xs font-medium py-2.5 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          Reservera
        </button>
      </div>

      {prepaidGuests.length > 0 && onAssignPrepaid && (
        <Popover open={assignOpen} onOpenChange={setAssignOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full rounded-xl border border-sky-200 bg-sky-50 text-sky-800 text-xs font-semibold py-2 flex items-center justify-center gap-1.5 hover:bg-sky-100 transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Matcha förbetald ({prepaidGuests.length})
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2 max-h-72 overflow-y-auto">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1">
              Välj förbetald gäst
            </div>
            <div className="flex flex-col gap-1">
              {prepaidGuests.map((g) => {
                const label =
                  g.guest_name ||
                  g.registration_number ||
                  (g.accommodation_type === "tent" ? "Tält" : "Gäst");
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={assigning}
                    onClick={async () => {
                      setAssigning(true);
                      try {
                        await onAssignPrepaid(g.id);
                        setAssignOpen(false);
                      } finally {
                        setAssigning(false);
                      }
                    }}
                    className="text-left rounded-lg px-2 py-2 hover:bg-accent disabled:opacity-50 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium truncate">{label}</span>
                    {g.payment_amount && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {g.payment_amount} {g.payment_currency ?? "kr"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {isExtra && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort platsen "{placeLabel}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Platsen försvinner från denna runda. Du kan lägga till den igen senare om du behöver.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Ta bort
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default QuickReserveCard;
