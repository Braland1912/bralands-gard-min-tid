import { useEffect, useRef, useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import type { GuestInput } from "@/hooks/useEveningRoundGuests";

interface Props {
  placeNumber: number;
  date: string;
  onQuickReserve: (input: GuestInput) => Promise<void> | void;
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const reset = () => {
    setName("");
    setOpen(false);
  };

  const handleReserve = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onQuickReserve({
        place_number: placeNumber,
        guest_name: trimmed,
        arrival_date: date,
        departure_date: addDays(date, 1),
        status: "here",
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-4 text-left hover:bg-muted transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">
            Plats {placeNumber}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
            Ledig
          </span>
        </div>
        <div className="text-base font-semibold text-foreground mt-1">
          Snabb-reservera
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          Tryck för att skriva gästnamn
          <ChevronRight className="h-3 w-3" />
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          Plats {placeNumber}
        </div>
        <button
          type="button"
          onClick={() => onOpenFull(placeNumber)}
          className="text-xs font-medium text-primary hover:underline"
        >
          Fler fält
        </button>
      </div>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleReserve();
          if (e.key === "Escape") reset();
        }}
        placeholder="Gästens namn"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-xl border border-border bg-card text-sm font-medium py-2 hover:bg-accent"
          disabled={saving}
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={handleReserve}
          disabled={!name.trim() || saving}
          className="flex-[1.4] rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-2 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Reservera
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        1 natt, status "Här". Justera betalsätt och datum via "Fler fält".
      </p>
    </div>
  );
};

export default QuickReserveCard;
