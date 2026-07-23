import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ListChecks, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateLabel, type EveningRoundGuest } from "@/hooks/useEveningRoundGuests";
import { findDuplicateGuests } from "@/lib/duplicate-guests";

interface Props {
  guests: EveningRoundGuest[];
  onDelete: (id: string) => void;
  variant?: "worker" | "admin";
}

/**
 * Visar en varningsbanner högst upp i kvällsrundan när samma regnummer finns
 * både som förbetald och manuellt inlagd på samma ankomstdatum.
 *
 * Två lägen:
 *  - Snabbläge: ett-klicks-radera per förbetald post (med bekräftelse).
 *  - Granskningsläge: kryssrutor per förbetald post + batch-bekräftelse så
 *    man kan gå igenom hela listan och välja exakt vilka som ska bort.
 */
const DuplicateGuestsAlert = ({ guests, onDelete, variant = "worker" }: Props) => {
  const groups = useMemo(() => findDuplicateGuests(guests), [guests]);
  const [open, setOpen] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmGuest, setConfirmGuest] = useState<EveningRoundGuest | null>(null);
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [bulkDate, setBulkDate] = useState<string | null>(null);

  // Rensa markeringar för poster som inte längre finns (raderade, sorterade bort).
  useEffect(() => {
    const validIds = new Set(
      groups.flatMap((g) => g.prepaid.map((p) => p.id)),
    );
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [groups]);

  if (groups.length === 0) return null;

  const totalPrepaid = groups.reduce((n, g) => n + g.prepaid.length, 0);
  const allPrepaidIds = groups.flatMap((g) => g.prepaid.map((p) => p.id));
  const allSelected = allPrepaidIds.length > 0 && allPrepaidIds.every((id) => selected.has(id));
  const noneSelected = selected.size === 0;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allPrepaidIds));
  };

  const selectedGuests = groups
    .flatMap((g) => g.prepaid)
    .filter((g) => selected.has(g.id));

  const byDate = useMemo(() => {
    const map = new Map<string, EveningRoundGuest[]>();
    groups.forEach((g) => {
      const prev = map.get(g.arrivalDate) ?? [];
      map.set(g.arrivalDate, [...prev, ...g.prepaid]);
    });
    return Array.from(map.entries())
      .map(([date, prepaid]) => ({ date, prepaid }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [groups]);

  const bulkDatePrepaid = bulkDate
    ? byDate.find((d) => d.date === bulkDate)?.prepaid ?? []
    : [];

  const confirmBatchDelete = () => {
    selectedGuests.forEach((g) => onDelete(g.id));
    setSelected(new Set());
    setConfirmBatch(false);
  };

  const confirmBulkDateDelete = () => {
    bulkDatePrepaid.forEach((g) => onDelete(g.id));
    setBulkDate(null);
  };

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
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setReviewMode((v) => !v);
                if (reviewMode) setSelected(new Set());
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border text-[11px] font-semibold px-2 py-1 transition-colors ${
                reviewMode
                  ? "bg-amber-900 text-amber-50 border-amber-900 hover:bg-amber-800"
                  : "bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              {reviewMode ? "Avsluta granskning" : "Granska och välj"}
            </button>
            {reviewMode && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
              >
                {allSelected ? "Avmarkera alla" : "Markera alla förbetalda"}
              </button>
            )}
          </div>

          {!reviewMode && byDate.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-100/60 px-2.5 py-2 space-y-1.5">
              <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wide">
                Snabbrensning per ankomstdatum
              </div>
              <div className="flex flex-wrap gap-1.5">
                {byDate.map(({ date, prepaid }) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setBulkDate(date)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-white text-destructive text-[11px] font-semibold px-2 py-1 hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    {formatDateLabel(date)} · radera {prepaid.length} förbetald
                    {prepaid.length === 1 ? "" : "a"}
                  </button>
                ))}
              </div>
            </div>
          )}


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
                {group.guests.map((g) => {
                  const isChecked = selected.has(g.id);
                  return (
                    <li key={g.id} className="flex items-center gap-2 px-2.5 py-2">
                      {reviewMode && g.is_prepaid ? (
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(g.id)}
                          aria-label={`Markera ${g.guest_name || "gäst"} för radering`}
                          className="shrink-0"
                        />
                      ) : reviewMode ? (
                        <span className="w-4 shrink-0" aria-hidden />
                      ) : null}
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
                      {!reviewMode && g.is_prepaid && (
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
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="text-[10px] text-amber-800/80 px-1">
            Tips: Behåll den manuella (den har betalning och anteckningar) och
            radera den förbetalda. Är du osäker — kolla anteckningar först.
          </p>

          {reviewMode && (
            <div className="sticky bottom-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white/95 backdrop-blur px-2.5 py-2 shadow-sm">
              <div className="text-[12px] text-amber-900">
                <span className="font-semibold">{selected.size}</span> vald
                {selected.size === 1 ? "" : "a"} av {totalPrepaid} förbetalda
              </div>
              <button
                type="button"
                disabled={noneSelected}
                onClick={() => setConfirmBatch(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive text-destructive-foreground text-[12px] font-semibold px-2.5 py-1.5 hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Radera valda
              </button>
            </div>
          )}
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

      <AlertDialog open={confirmBatch} onOpenChange={(o) => !o && setConfirmBatch(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Radera {selectedGuests.length} förbetald
              {selectedGuests.length === 1 ? "" : "a"} post
              {selectedGuests.length === 1 ? "" : "er"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Följande förbetalda poster tas bort. De manuellt inlagda gästerna
                  finns kvar. Varje radering loggas i historiken.
                </p>
                <ul className="max-h-52 overflow-auto rounded-md border border-border bg-muted/40 divide-y divide-border text-[12px]">
                  {selectedGuests.map((g) => (
                    <li key={g.id} className="px-2.5 py-1.5">
                      <div className="font-medium text-foreground truncate">
                        {g.guest_name || "(utan namn)"}
                        {g.registration_number ? ` · ${g.registration_number}` : ""}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {g.place_label ? `Plats ${g.place_label}` : "Ingen plats"}
                        {" · "}
                        Ankomst {formatDateLabel(g.arrival_date)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmBatchDelete}
            >
              Radera {selectedGuests.length} post
              {selectedGuests.length === 1 ? "" : "er"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default DuplicateGuestsAlert;
