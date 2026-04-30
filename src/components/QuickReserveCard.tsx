import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { GuestInput } from "@/hooks/useEveningRoundGuests";

interface Props {
  placeLabel: string;
  date: string;
  onQuickReserve: (input: GuestInput) => Promise<unknown> | unknown;
  onOpenFull: (place: string) => void;
  /** Visas endast för egna extra-platser. Om satt går platsen att ta bort. */
  onRemoveExtraPlace?: () => void;
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

const QuickReserveCard = ({ placeLabel, date, onQuickReserve, onOpenFull, onRemoveExtraPlace }: Props) => {
  const [saving, setSaving] = useState(false);
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
    if (window.confirm(`Ta bort platsen "${placeLabel}"?`)) {
      onRemoveExtraPlace();
    }
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
              onClick={handleRemove}
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
    </div>
  );
};

export default QuickReserveCard;
