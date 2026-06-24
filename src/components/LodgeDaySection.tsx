import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Home } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LodgeEvent,
  UNIT_NUMBER,
  splitByRole,
  styleFor,
  useLodgeEvents,
} from "@/lib/lodge-calendar";

interface Props {
  /** Datum i ISO-format (yyyy-MM-dd) som passet gäller. */
  date: string;
  /** Visas före checklistor. Default true. */
  showHeader?: boolean;
}

/**
 * "Lodgen idag" — kompakt, hopfällbar sektion i passvyn.
 * Default utfälld om det finns avfärd på dagen.
 */
const LodgeDaySection = ({ date, showHeader = true }: Props) => {
  const { data, isLoading, error } = useLodgeEvents();
  const day = useMemo(() => {
    const d = parseISO(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [date]);

  const storageKey = `lodge-day-section:${date}`;
  const [open, setOpen] = useState<boolean>(true);

  const events = data?.events ?? [];
  const { arrivals, departures, ongoing, potentialUnits, dayEvents } = useMemo(
    () => splitByRole(events, day),
    [events, day],
  );

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    if (stored !== null) {
      setOpen(stored === "1");
    } else {
      setOpen(departures.length > 0);
    }
  }, [storageKey, departures.length]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try { window.localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const renderCard = (e: LodgeEvent, badge?: { text: string; cls: string }) => {
    const s = styleFor(e.unit);
    const endInclusive = addDays(parseISO(e.end), -1);
    const sameDay = e.start === format(endInclusive, "yyyy-MM-dd");
    return (
      <div key={e.uid + e.start} className={`p-2 rounded-lg border ${s.chip}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-2 w-2 rounded-full ${s.dot} shrink-0`} />
            <span className="text-sm font-semibold truncate">
              {UNIT_NUMBER[e.unit] ? `${UNIT_NUMBER[e.unit]} ` : ""}{e.unit}
            </span>
          </div>
          {badge && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.cls}`}>
              {badge.text}
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5">{e.summary}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {e.allDay ? (
            sameDay ? <>Hela dagen</> : (
              <>{format(parseISO(e.start), "d MMM", { locale: sv })} – {format(endInclusive, "d MMM", { locale: sv })}</>
            )
          ) : (
            <>{e.startTime} {e.endTime ? `– ${e.endTime}` : ""}</>
          )}
        </div>
      </div>
    );
  };

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <div className="flex items-center justify-between mt-2 mb-1 first:mt-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <span className="text-[10px] text-muted-foreground">{count}</span>
    </div>
  );

  const summaryText =
    departures.length > 0
      ? `${departures.length} avfärd · bytesdag`
      : dayEvents.length > 0
      ? `${dayEvents.length} aktiva bokningar`
      : "Inga avfärder idag";

  return (
    <section className="border rounded-xl bg-[hsl(38_60%_96%)] border-[hsl(38_60%_88%)] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-[hsl(38_60%_92%)] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-[hsl(38_60%_90%)] shrink-0">
            <Home className="h-3 w-3 text-[hsl(32_55%_38%)]" />
          </div>
          <div className="min-w-0">
            {showHeader && (
              <div className="text-sm font-semibold text-foreground leading-tight">Lodgen idag</div>
            )}
            <div className="text-[11px] text-muted-foreground leading-tight truncate">{summaryText}</div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : error ? (
            <p className="text-xs text-destructive">Kunde inte ladda lodge-kalendern.</p>
          ) : (
            <div>
              {dayEvents.length === 0 && potentialUnits.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Inga bokningar idag.</p>
              )}

              {departures.length > 0 && (
                <>
                  <SectionHeader title="Avfärd" count={departures.length} />
                  <div className="space-y-1.5">
                    {departures.map((e) =>
                      renderCard(e, {
                        text: "Bytesdag – städa!",
                        cls: "bg-orange-300 text-orange-950 border-orange-400",
                      }),
                    )}
                  </div>
                </>
              )}

              {arrivals.length > 0 && (
                <>
                  <SectionHeader title="Ankomst" count={arrivals.length} />
                  <div className="space-y-1.5">
                    {arrivals.map((e) =>
                      renderCard(e, {
                        text: "Kontrollera inför ankomst",
                        cls: "bg-orange-200 text-orange-900 border-orange-300",
                      }),
                    )}
                  </div>
                </>
              )}

              {ongoing.length > 0 && (
                <>
                  <SectionHeader title="Pågående" count={ongoing.length} />
                  <div className="space-y-1.5">{ongoing.map((e) => renderCard(e))}</div>
                </>
              )}

              {potentialUnits.length > 0 && (
                <>
                  <SectionHeader title="Kan tillkomma vid sen bokning" count={potentialUnits.length} />
                  <div className="space-y-1.5">
                    {potentialUnits.map((u) => {
                      const s = styleFor(u);
                      return (
                        <div key={u} className={`p-2 rounded-lg border border-dashed ${s.chip} opacity-90`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full ${s.dot} shrink-0`} />
                            <span className="text-sm font-semibold truncate">
                              {UNIT_NUMBER[u]} {u}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Ej bokad ännu – kan få en sen bokning med avfärd idag.
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default LodgeDaySection;
