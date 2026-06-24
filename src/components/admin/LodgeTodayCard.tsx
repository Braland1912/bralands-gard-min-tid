import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Home } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import {
  LodgeEvent,
  UNIT_NUMBER,
  splitByRole,
  styleFor,
  useLodgeEvents,
} from "@/lib/lodge-calendar";

interface LodgeTodayCardProps {
  onOpen?: () => void;
}

const LodgeTodayCard = ({ onOpen }: LodgeTodayCardProps) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data, isLoading, error } = useLodgeEvents();
  const events = data?.events ?? [];
  const { arrivals, departures, ongoing, potentialUnits, dayEvents } = splitByRole(events, today);

  const renderCard = (e: LodgeEvent, badge?: { text: string; cls: string }) => {
    const s = styleFor(e.unit);
    const endInclusive = addDays(parseISO(e.end), -1);
    const sameDay = e.start === format(endInclusive, "yyyy-MM-dd");
    return (
      <div key={e.uid + e.start} className={`p-2.5 rounded-lg border ${s.chip}`}>
        <div className="flex items-start justify-between gap-2 mb-0.5">
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
        <div className="text-xs">{e.summary}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {e.allDay ? (
            sameDay ? <>Hela dagen</> : (
              <>
                {format(parseISO(e.start), "d MMM", { locale: sv })} – {format(endInclusive, "d MMM", { locale: sv })}
              </>
            )
          ) : (
            <>{e.startTime} {e.endTime ? `– ${e.endTime}` : ""}</>
          )}
        </div>
      </div>
    );
  };

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <div className="flex items-center justify-between mt-2.5 mb-1.5 first:mt-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <span className="text-[10px] text-muted-foreground">{count}</span>
    </div>
  );

  return (
    <section className="border rounded-2xl p-3 space-y-2.5 bg-[hsl(38_60%_96%)] border-[hsl(38_60%_88%)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-[hsl(38_60%_90%)]">
            <Home className="h-3.5 w-3.5 text-[hsl(32_55%_38%)]" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Lodgen idag</h3>
        </div>
        {onOpen && (
          <button onClick={onOpen} className="text-xs text-primary hover:underline">
            Öppna kalender
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
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
                  })
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
                  })
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
                    <div key={u} className={`p-2.5 rounded-lg border border-dashed ${s.chip} opacity-90`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full ${s.dot} shrink-0`} />
                          <span className="text-sm font-semibold truncate">
                            {UNIT_NUMBER[u]} {u}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-800 border-orange-200 whitespace-nowrap">
                          Kan tillkomma
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
    </section>
  );
};

export default LodgeTodayCard;
