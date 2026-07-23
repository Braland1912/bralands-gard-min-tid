import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Pencil, Trash2 } from "lucide-react";
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
import {
  formatDateLabel,
  type EveningRoundGuest,
} from "@/hooks/useEveningRoundGuests";
import { findDuplicateGuests } from "@/lib/duplicate-guests";

type StatusFilter = "all" | "prepaid" | "manual";

interface Props {
  guests: EveningRoundGuest[];
  selectedDate: string;
  onEdit: (guest: EveningRoundGuest) => void;
  onDelete: (id: string) => void;
}

/**
 * Adminvy för granskning av dubblettpar (samma regnummer + ankomstdatum där
 * både förbetald och manuell finns). Låter admin filtrera på status och
 * markera flera poster för batch-radering.
 *
 * Visar bara dubbletter som är relevanta för valt datum, dvs. antingen ankommer
 * på datumet eller bor kvar över datumet.
 */
const AdminDuplicatesPanel = ({ guests, selectedDate, onEdit, onDelete }: Props) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBatch, setConfirmBatch] = useState(false);

  const groups = useMemo(() => findDuplicateGuests(guests), [guests]);

  const dateFiltered = useMemo(
    () =>
      groups.filter((g) =>
        g.guests.some(
          (x) => x.arrival_date <= selectedDate && x.departure_date > selectedDate,
        ),
      ),
    [groups, selectedDate],
  );

  const totals = useMemo(() => {
    let prepaid = 0;
    let manual = 0;
    for (const g of dateFiltered) {
      prepaid += g.prepaid.length;
      manual += g.manual.length;
    }
    return { prepaid, manual, all: prepaid + manual };
  }, [dateFiltered]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleGuestsInGroup = (group: (typeof dateFiltered)[number]) =>
    group.guests.filter((g) => {
      if (statusFilter === "prepaid") return g.is_prepaid;
      if (statusFilter === "manual") return !g.is_prepaid;
      return true;
    });

  const allVisibleIds = useMemo(
    () => dateFiltered.flatMap((g) => visibleGuestsInGroup(g).map((x) => x.id)),
    [dateFiltered, statusFilter],
  );
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  const selectedGuests = dateFiltered
    .flatMap((g) => g.guests)
    .filter((g) => selected.has(g.id));

  const confirmDelete = () => {
    selectedGuests.forEach((g) => onDelete(g.id));
    setSelected(new Set());
    setConfirmBatch(false);
  };

  const filterChips: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "Alla", count: totals.all },
    { id: "prepaid", label: "Förbetalda", count: totals.prepaid },
    { id: "manual", label: "Manuella", count: totals.manual },
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
      <header className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-amber-950 leading-tight">
            Dubblettgranskning ({dateFiltered.length}{" "}
            {dateFiltered.length === 1 ? "par" : "par"})
          </h2>
          <p className="text-[11px] text-amber-800/80 leading-tight">
            Samma regnummer inlagt både förbetalt och manuellt för{" "}
            {formatDateLabel(selectedDate)}.
          </p>
        </div>
      </header>

      {dateFiltered.length === 0 ? (
        <div className="rounded-lg bg-white border border-amber-200 px-3 py-6 text-center text-sm text-muted-foreground">
          Inga dubbletter för valt datum.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {filterChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border text-[12px] font-semibold px-2.5 py-1 transition-colors ${
                  statusFilter === c.id
                    ? "bg-amber-900 text-amber-50 border-amber-900"
                    : "bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
                }`}
              >
                {c.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    statusFilter === c.id
                      ? "bg-amber-50/20 text-amber-50"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {c.count}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(allVisibleIds))
              }
              className="ml-auto text-[11px] font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
            >
              {allSelected ? "Avmarkera alla" : "Markera alla synliga"}
            </button>
          </div>

          <div className="space-y-2">
            {dateFiltered.map((group) => {
              const visible = visibleGuestsInGroup(group);
              if (visible.length === 0) return null;
              return (
                <div
                  key={`${group.arrivalDate}-${group.reg}`}
                  className="rounded-lg border border-amber-200 bg-white overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-100/60 border-b border-amber-200">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-amber-950 truncate">
                        Regnr {group.reg}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(group.reg);
                        }}
                        aria-label="Kopiera regnummer"
                        className="text-amber-700 hover:text-amber-900"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-amber-800/80">
                      Ankomst {formatDateLabel(group.arrivalDate)} · {group.prepaid.length} förbetalda / {group.manual.length} manuella
                    </div>
                  </div>
                  <ul className="divide-y divide-amber-100">
                    {visible.map((g) => (
                      <li key={g.id} className="flex items-center gap-2 px-2.5 py-2">
                        <Checkbox
                          checked={selected.has(g.id)}
                          onCheckedChange={() => toggleOne(g.id)}
                          aria-label={`Markera ${g.guest_name || "gäst"}`}
                          className="shrink-0"
                        />
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
                            {g.payment_method ? ` · ${g.payment_method}` : ""}
                            {g.payment_amount
                              ? ` ${g.payment_amount} ${g.payment_currency ?? ""}`
                              : ""}
                            {g.notes ? ` · ${g.notes.slice(0, 40)}${g.notes.length > 40 ? "…" : ""}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEdit(g)}
                          aria-label="Redigera"
                          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white/95 backdrop-blur px-2.5 py-2 shadow-sm">
            <div className="text-[12px] text-amber-900">
              <span className="font-semibold">{selected.size}</span> markerad
              {selected.size === 1 ? "" : "e"}
            </div>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setConfirmBatch(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive text-destructive-foreground text-[12px] font-semibold px-2.5 py-1.5 hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Radera markerade
            </button>
          </div>
        </>
      )}

      <AlertDialog open={confirmBatch} onOpenChange={(o) => !o && setConfirmBatch(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Radera {selectedGuests.length} post
              {selectedGuests.length === 1 ? "" : "er"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Åtgärden loggas i historiken. Detta går inte att ångra.</p>
                <ul className="max-h-52 overflow-auto rounded-md border border-border bg-muted/40 divide-y divide-border text-[12px]">
                  {selectedGuests.map((g) => (
                    <li key={g.id} className="px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            g.is_prepaid
                              ? "bg-sky-100 text-sky-800 border border-sky-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {g.is_prepaid ? "Förbetald" : "Manuell"}
                        </span>
                        <span className="font-medium text-foreground truncate">
                          {g.guest_name || "(utan namn)"}
                          {g.registration_number ? ` · ${g.registration_number}` : ""}
                        </span>
                      </div>
                      <div className="text-muted-foreground truncate pl-1">
                        {g.place_label ? `Plats ${g.place_label}` : "Ingen plats"} ·
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
              onClick={confirmDelete}
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

export default AdminDuplicatesPanel;
