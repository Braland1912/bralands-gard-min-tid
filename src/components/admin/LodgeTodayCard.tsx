import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Home } from "lucide-react";
import { addDays, format, parseISO, isWithinInterval } from "date-fns";
import { sv } from "date-fns/locale";

type LodgeEvent = {
  uid: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  unit: string;
};

const UNIT_ORDER = ["Öringen", "Laxen", "Kungsfiskaren", "Strömstaren", "Husvagnen"] as const;
const UNIT_NUMBER: Record<string, string> = {
  "Öringen": "Nr. 1",
  "Laxen": "Nr. 2",
  "Kungsfiskaren": "Nr. 3",
  "Strömstaren": "Nr. 4",
  "Husvagnen": "Nr. 5",
};
const UNIT_STYLES: Record<string, { dot: string; chip: string }> = {
  "Öringen":       { dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-800 border-amber-200" },
  "Laxen":         { dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-800 border-rose-200" },
  "Kungsfiskaren": { dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-800 border-sky-200" },
  "Strömstaren":   { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  "Husvagnen":     { dot: "bg-violet-500",  chip: "bg-violet-50 text-violet-800 border-violet-200" },
};
const styleFor = (unit: string) =>
  UNIT_STYLES[unit] ?? { dot: "bg-gray-400", chip: "bg-gray-50 text-gray-700 border-gray-200" };

type Role = "start" | "middle" | "end" | "single";
const roleForDay = (e: LodgeEvent, day: Date): Role | null => {
  const start = parseISO(e.start);
  const endInclusive = addDays(parseISO(e.end), -1);
  const last = endInclusive < start ? start : endInclusive;
  if (!isWithinInterval(day, { start, end: last })) return null;
  const isStart = day.getTime() === start.getTime();
  const isEnd = day.getTime() === last.getTime();
  if (isStart && isEnd) return "single";
  if (isStart) return "start";
  if (isEnd) return "end";
  return "middle";
};

interface LodgeTodayCardProps {
  onOpen?: () => void;
}

const LodgeTodayCard = ({ onOpen }: LodgeTodayCardProps) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["lodge-calendar"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ej inloggad");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lodge-calendar`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ events: LodgeEvent[] }>;
    },
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const events = data?.events ?? [];
  const dayEvents = events.filter((e) => roleForDay(e, today) !== null);
  const arrivals = dayEvents.filter((e) => {
    const r = roleForDay(e, today);
    return r === "start" || r === "single";
  });
  const departures = dayEvents.filter((e) => roleForDay(e, today) === "end");
  const ongoing = dayEvents.filter((e) => roleForDay(e, today) === "middle");
  const busyUnits = new Set(dayEvents.map((e) => e.unit));
  const potentialUnits = UNIT_ORDER.filter((u) => !busyUnits.has(u));

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
