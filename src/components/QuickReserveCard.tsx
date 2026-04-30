import { useState } from "react";
import { Plus } from "lucide-react";
import type { GuestInput } from "@/hooks/useEveningRoundGuests";

interface Props {
  placeNumber: number;
  date: string;
  onQuickReserve: (input: GuestInput) => Promise<unknown> | unknown;
  onOpenFull: (place: number) => void;
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

const QuickReserveCard = ({ placeNumber, date, onQuickReserve, onOpenFull }: Props) => {
  const [saving, setSaving] = useState(false);

  const handleReserve = async () => {
    setSaving(true);
    try {
      await onQuickReserve({
        place_number: placeNumber,
        guest_name: "",
        arrival_date: date,
        departure_date: addDays(date, 1),
        status: "here",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          Plats {placeNumber}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
          Ledig
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleReserve}
          disabled={saving}
          className="flex-[1.6] rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-2.5 disabled:opacity-40 flex items-center justify-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Reservera
        </button>
        <button
          type="button"
          onClick={() => onOpenFull(placeNumber)}
          className="flex-1 rounded-xl border border-border bg-card text-xs font-medium py-2.5 hover:bg-accent text-muted-foreground"
        >
          Fler fält
        </button>
      </div>
    </div>
  );
};

export default QuickReserveCard;
