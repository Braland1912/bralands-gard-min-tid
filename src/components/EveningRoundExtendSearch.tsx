import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CalendarPlus2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  type EveningRoundGuest,
  PAYMENT_LABELS,
} from "@/hooks/useEveningRoundGuests";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Datumet man tittar på (idag eller framtida). */
  viewDate: string;
  onPick: (guest: EveningRoundGuest) => void;
}

const shiftIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const formatShort = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

const EveningRoundExtendSearch = ({ open, onOpenChange, viewDate, onPick }: Props) => {
  const [search, setSearch] = useState("");

  const fromDate = useMemo(() => shiftIso(viewDate, -30), [viewDate]);

  const { data: guests = [], isLoading } = useQuery({
    queryKey: ["evening-round-extend-search", fromDate, viewDate],
    queryFn: async () => {
      // Gäster vars vistelse redan är slut (departure_date <= viewDate),
      // inom ~30 dagar bakåt, så vi inte listar urgammalt.
      const { data, error } = await supabase
        .from("evening_round_guests")
        .select("*")
        .gte("departure_date", fromDate)
        .lte("departure_date", viewDate)
        .order("departure_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as EveningRoundGuest[];
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return guests;
    return guests.filter((g) => {
      return (
        g.guest_name?.toLowerCase().includes(s) ||
        g.registration_number?.toLowerCase().includes(s) ||
        g.place_label?.toLowerCase().includes(s)
      );
    });
  }, [guests, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus2 className="h-5 w-5" />
            Förläng tidigare gäst
          </DialogTitle>
          <DialogDescription>
            Sök bland gäster vars vistelse redan tagit slut. Välj en för att förlänga.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök namn, reg.nr eller plats…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Laddar…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search ? "Inga gäster matchade sökningen." : "Inga tidigare gäster."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(g);
                      onOpenChange(false);
                    }}
                    className="w-full text-left py-3 hover:bg-accent/40 px-2 -mx-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {g.registration_number || g.guest_name || "Okänd"}
                          {g.place_label && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              · Plats {g.place_label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatShort(g.arrival_date)} → {formatShort(g.departure_date)}
                          {g.payment_method && g.payment_amount
                            ? ` · ${PAYMENT_LABELS[g.payment_method]} ${g.payment_amount} ${g.payment_currency ?? "SEK"}`
                            : " · Ej betalt"}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" tabIndex={-1}>
                        Förläng
                      </Button>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EveningRoundExtendSearch;
