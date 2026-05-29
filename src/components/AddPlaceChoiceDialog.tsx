import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserCheck, MapPinPlus, CreditCard, ChevronRight } from "lucide-react";
import type { EveningRoundGuest } from "@/hooks/useEveningRoundGuests";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prepaidGuests: EveningRoundGuest[];
  /** Användaren valde att lägga till en helt ny gäst på en ny tillfällig plats. */
  onPickNewGuest: () => void;
  /** Användaren valde att koppla en redan förbetald gäst till en ny tillfällig plats. */
  onPickPrepaid: (guest: EveningRoundGuest) => void;
}

/**
 * Mellandialog som visas när användaren trycker "Lägg till plats".
 * Erbjuder två val:
 *  1) Koppla en redan förbetald gäst som dykt upp.
 *  2) Lägga till en helt ny gäst på platsen.
 */
const AddPlaceChoiceDialog = ({
  open,
  onOpenChange,
  prepaidGuests,
  onPickNewGuest,
  onPickPrepaid,
}: Props) => {
  const [showPrepaidList, setShowPrepaidList] = useState(false);

  // Återställ läget när dialogen stängs så nästa öppning börjar från val-vyn.
  const handleOpenChange = (next: boolean) => {
    if (!next) setShowPrepaidList(false);
    onOpenChange(next);
  };

  const hasPrepaid = prepaidGuests.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till plats</DialogTitle>
          <DialogDescription>
            {showPrepaidList
              ? "Välj vilken förbetald gäst som har dykt upp."
              : "Vad vill du göra?"}
          </DialogDescription>
        </DialogHeader>

        {!showPrepaidList && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                if (hasPrepaid) setShowPrepaidList(true);
              }}
              disabled={!hasPrepaid}
              className="w-full text-left rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100/70 disabled:opacity-50 disabled:cursor-not-allowed p-4 transition-colors flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  Koppla förbetald gäst
                </div>
                <div className="text-xs text-muted-foreground">
                  {hasPrepaid
                    ? `${prepaidGuests.length} förbetald${prepaidGuests.length === 1 ? "" : "a"} utan plats`
                    : "Inga omatchade förbetalda just nu"}
                </div>
              </div>
              {hasPrepaid && <ChevronRight className="h-4 w-4 text-sky-700 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => onPickNewGuest()}
              className="w-full text-left rounded-xl border border-border bg-card hover:bg-accent p-4 transition-colors flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPinPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  Lägg till ny gäst
                </div>
                <div className="text-xs text-muted-foreground">
                  Registrera en ny gäst på en tillfällig plats
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        )}

        {showPrepaidList && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {prepaidGuests.map((g) => {
              const label =
                g.guest_name ||
                g.registration_number ||
                (g.accommodation_type === "tent" ? "Tält" : "Gäst");
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onPickPrepaid(g)}
                  className="w-full text-left rounded-xl border border-sky-200 bg-card hover:bg-sky-50 p-3 transition-colors flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {label}
                    </div>
                    {(g.registration_number || g.nationality) && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {[g.registration_number, g.nationality].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  {g.payment_amount != null && (
                    <span className="text-[11px] text-sky-800 shrink-0 inline-flex items-center gap-0.5">
                      <CreditCard className="h-3 w-3" />
                      {g.payment_amount} {g.payment_currency ?? "kr"}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowPrepaidList(false)}
              className="w-full text-center text-sm text-muted-foreground py-2 hover:text-foreground"
            >
              ← Tillbaka
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddPlaceChoiceDialog;
