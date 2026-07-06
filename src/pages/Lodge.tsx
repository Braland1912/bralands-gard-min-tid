import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ArrowLeft, RefreshCw, Home, Calendar as CalendarIcon, X } from "lucide-react";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, parseISO, isWithinInterval } from "date-fns";
import { sv } from "date-fns/locale";


type LodgeEvent = {
  uid: string;
  summary: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD (exclusive)
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  unit: string;
};

// De fem uthyrningsbara enheterna i lodgen, i fast ordning
const UNIT_ORDER = ["Öringen", "Laxen", "Kungsfiskaren", "Strömstaren", "Husvagnen"] as const;
const UNIT_NUMBER: Record<string, string> = {
  "Öringen": "Nr. 1",
  "Laxen": "Nr. 2",
  "Kungsfiskaren": "Nr. 3",
  "Strömstaren": "Nr. 4",
  "Husvagnen": "Nr. 5",
};

const UNIT_STYLES: Record<string, { bar: string; text: string; dot: string; chip: string }> = {
  "Öringen":       { bar: "bg-amber-400",   text: "text-amber-950",   dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-800 border-amber-200" },
  "Laxen":         { bar: "bg-rose-400",    text: "text-rose-950",    dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-800 border-rose-200" },
  "Kungsfiskaren": { bar: "bg-sky-400",     text: "text-sky-950",     dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-800 border-sky-200" },
  "Strömstaren":   { bar: "bg-emerald-400", text: "text-emerald-950", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  "Husvagnen":     { bar: "bg-violet-400",  text: "text-violet-950",  dot: "bg-violet-500",  chip: "bg-violet-50 text-violet-800 border-violet-200" },
};

const styleFor = (unit: string) =>
  UNIT_STYLES[unit] ?? { bar: "bg-gray-300", text: "text-gray-900", dot: "bg-gray-400", chip: "bg-gray-50 text-gray-700 border-gray-200" };

const Lodge = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: worker, isLoading: workerLoading } = useWorker(user?.id);
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [cursor, setCursor] = useState(new Date());
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [unitFilter, setUnitFilter] = useState<Set<string>>(new Set(UNIT_ORDER));

  const canAccess = isAdmin || worker?.can_see_lodge === true;
  const ready = !workerLoading && !adminLoading;

  const forceRefreshRef = useRef(false);
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["lodge-calendar"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ej inloggad");
      const force = forceRefreshRef.current;
      forceRefreshRef.current = false;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lodge-calendar${force ? "?refresh=1" : ""}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Fel ${res.status}`);
      }
      return res.json() as Promise<{ events: LodgeEvent[]; fetchedAt: number }>;
    },
    enabled: ready && canAccess && !!user,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const events = data?.events ?? [];

  // Hämta inloggad användares schemalagda (publicerade) pass för synligt månadsrutnät
  const rangeFrom = format(startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const rangeTo = format(endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const { data: myShiftDates } = useQuery({
    queryKey: ["lodge-my-shifts", user?.id, rangeFrom, rangeTo],
    queryFn: async () => {
      if (!user?.id) return new Set<string>();
      const [shiftsRes, daysRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("date,shift_type")
          .eq("user_id", user.id)
          .eq("shift_type", "day")
          .gte("date", rangeFrom)
          .lte("date", rangeTo),
        supabase
          .from("schedule_days")
          .select("date,is_published")
          .gte("date", rangeFrom)
          .lte("date", rangeTo),
      ]);
      const published = new Set(
        (daysRes.data || []).filter((d: any) => d.is_published === true).map((d: any) => d.date),
      );
      const set = new Set<string>();
      (shiftsRes.data || []).forEach((s: any) => {
        if (published.has(s.date)) set.add(s.date);
      });
      return set;
    },
    enabled: !!user?.id && ready && canAccess,
    staleTime: 5 * 60 * 1000,
  });

  // Dagpass-schemalagda per datum (publicerade) — för Bytesdagar-listan
  const dayShiftFrom = format(new Date(), "yyyy-MM-dd");
  const dayShiftTo = format(addDays(new Date(), 90), "yyyy-MM-dd");
  const { data: dayShiftsByDate } = useQuery({
    queryKey: ["lodge-day-shifts", dayShiftFrom, dayShiftTo],
    queryFn: async () => {
      const [shiftsRes, daysRes, workersRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("date,user_id")
          .eq("shift_type", "day")
          .gte("date", dayShiftFrom)
          .lte("date", dayShiftTo),
        supabase
          .from("schedule_days")
          .select("date,is_published")
          .gte("date", dayShiftFrom)
          .lte("date", dayShiftTo),
        supabase.from("workers").select("user_id,name"),
      ]);
      const published = new Set(
        (daysRes.data || []).filter((d: any) => d.is_published === true).map((d: any) => d.date),
      );
      const nameByUser = new Map<string, string>();
      (workersRes.data || []).forEach((w: any) => {
        if (w.user_id) nameByUser.set(w.user_id, w.name);
      });
      const map = new Map<string, string[]>();
      (shiftsRes.data || []).forEach((s: any) => {
        if (!published.has(s.date)) return;
        const name = nameByUser.get(s.user_id);
        if (!name) return;
        if (!map.has(s.date)) map.set(s.date, []);
        map.get(s.date)!.push(name);
      });
      return map;
    },
    enabled: ready && canAccess,
    staleTime: 5 * 60 * 1000,
  });


  // Bygg månadsrutnät
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = useMemo(() => {
    const result: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [gridStart.getTime(), gridEnd.getTime()]);

  const eventsForDay = (day: Date): LodgeEvent[] => {
    return events.filter((e) => {
      const start = parseISO(e.start);
      const endExclusive = parseISO(e.end);
      const endInclusive = addDays(endExclusive, -1);
      const last = endInclusive < start ? start : endInclusive;
      return isWithinInterval(day, { start, end: last });
    });
  };

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

  // Hitta event för en given enhet och dag
  const eventForUnitDay = (unit: string, day: Date): LodgeEvent | undefined => {
    return events.find((e) => e.unit === unit && roleForDay(e, day) !== null);
  };

  const unitsInMonth = useMemo(() => {
    const set = new Set<string>();
    days.forEach((d) => eventsForDay(d).forEach((e) => set.add(e.unit)));
    // Behåll fast ordning Nr.1–Nr.4
    return UNIT_ORDER.filter((u) => set.has(u));
  }, [days, events]);

  if (!ready) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h1 className="text-xl font-semibold mb-2">Logga in</h1>
        <p className="text-muted-foreground mb-4">Du måste vara inloggad för att se uthyrningskalendern.</p>
        <Button onClick={() => navigate("/login")}>Till inloggning</Button>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h1 className="text-xl font-semibold mb-2">Saknar behörighet</h1>
        <p className="text-muted-foreground mb-4">Be en admin slå på "Kan se uthyrningskalendern" för dig under Team.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Tillbaka
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-6">
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Hem">
              <Home className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Uthyrning i lodgen</h1>
              <p className="text-xs text-muted-foreground">Bokningar från iCloud-kalendern</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { forceRefreshRef.current = true; refetch(); }} disabled={isFetching} aria-label="Uppdatera">
            <RefreshCw className={`h-5 w-5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Månadsnavigering */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <div className="text-base md:text-lg font-semibold capitalize">
                {format(cursor, "LLLL yyyy", { locale: sv })}
              </div>
              {!isSameMonth(cursor, new Date()) && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setCursor(new Date())}
                >
                  Idag
                </button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Veckodagar */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] md:text-xs font-medium text-muted-foreground text-center">
            {["Mån","Tis","Ons","Tor","Fre","Lör","Sön"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Rutnät */}
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : error ? (
            <div className="text-center text-sm text-destructive py-8">
              Kunde inte ladda kalendern. {(error as Error).message}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-0 border-l border-t border-border rounded-lg overflow-hidden">
              {days.map((day) => {
                const inMonth = isSameMonth(day, cursor);
                const today = isToday(day);
                const isMyShift = myShiftDates?.has(format(day, "yyyy-MM-dd")) ?? false;
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setOpenDay(day)}
                    className={`min-h-[92px] md:min-h-[112px] p-1 border-r border-b border-border text-left transition-colors flex flex-col relative ${
                      today
                        ? "bg-primary/10 ring-2 ring-primary ring-inset z-10"
                        : isMyShift && inMonth
                        ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
                        : inMonth
                        ? "bg-card hover:bg-accent"
                        : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div className={`text-[11px] md:text-xs font-medium mb-1 flex items-center gap-1 ${today ? "text-primary font-bold" : ""}`}>
                      <span>{format(day, "d")}</span>
                      
                      {isMyShift && !today && (
                        <span className="ml-auto text-[8px] md:text-[9px] uppercase tracking-wide font-semibold text-primary/80">
                          Mitt pass
                        </span>
                      )}
                      {isMyShift && today && (
                        <span className="ml-auto text-[8px] md:text-[9px] uppercase tracking-wide font-semibold text-primary">
                          Mitt pass
                        </span>
                      )}
                    </div>

                    {/* Fyra fasta rader, en per uthyrningsenhet */}
                    <div className="flex flex-col gap-[2px]">
                      {UNIT_ORDER.map((unit) => {
                        const e = eventForUnitDay(unit, day);
                        const s = styleFor(unit);
                        if (!e) {
                          return <div key={unit} className="h-3 md:h-4" />;
                        }
                        const role = roleForDay(e, day)!;
                        // Halvdagar: ankomst = höger halva, avfärd = vänster halva
                        const pos =
                          role === "start"
                            ? "left-1/2 right-0 rounded-l-sm"
                            : role === "end"
                            ? "left-0 right-1/2 rounded-r-sm"
                            : role === "single"
                            ? "left-0 right-0 rounded-sm"
                            : "left-0 right-0"; // middle: edge-to-edge, ingen rundning
                        const showName = role === "start" || role === "single";
                        return (
                          <div
                            key={unit}
                            className="relative h-3 md:h-4"
                            title={`${UNIT_NUMBER[unit]} ${unit} – ${e.summary}`}
                          >
                            <div className={`absolute inset-y-0 ${pos} ${s.bar} flex items-center`}>
                              {showName && (
                                <span className={`text-[8px] md:text-[10px] font-semibold ${s.text} px-1 truncate leading-none`}>
                                  {unit}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Bytesdagar – filter per enhet */}
        {!isLoading && !error && (() => {
          const todayRef = new Date();
          todayRef.setHours(0, 0, 0, 0);
          type Change = { date: Date; dateISO: string; units: { unit: string; event: LodgeEvent }[] };
          const byDate = new Map<string, Change>();
          for (const e of events) {
            if (!unitFilter.has(e.unit)) continue;
            // Avfärd = end (exklusiv) - 1 dag = bytesdag
            const dep = addDays(parseISO(e.end), -1);
            dep.setHours(0, 0, 0, 0);
            if (dep < todayRef) continue;
            const key = format(dep, "yyyy-MM-dd");
            if (!byDate.has(key)) byDate.set(key, { date: dep, dateISO: key, units: [] });
            byDate.get(key)!.units.push({ unit: e.unit, event: e });
          }
          const changes = Array.from(byDate.values())
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 30);

          const toggleUnit = (u: string) => {
            setUnitFilter((prev) => {
              const next = new Set(prev);
              if (next.has(u)) next.delete(u);
              else next.add(u);
              return next;
            });
          };
          const allOn = unitFilter.size === UNIT_ORDER.length;

          return (
            <Card className="p-4 mb-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <div>
                  <div className="text-sm font-semibold">Bytesdagar</div>
                  <div className="text-xs text-muted-foreground">Kommande avfärder – filtrera per enhet</div>
                </div>
                <button
                  onClick={() => setUnitFilter(allOn ? new Set() : new Set(UNIT_ORDER))}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  {allOn ? "Rensa" : "Välj alla"}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {UNIT_ORDER.map((u) => {
                  const s = styleFor(u);
                  const on = unitFilter.has(u);
                  return (
                    <button
                      key={u}
                      onClick={() => toggleUnit(u)}
                      className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
                        on ? s.chip : "bg-muted/40 text-muted-foreground border-border opacity-60"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${on ? s.dot : "bg-muted-foreground/40"}`} />
                      <span className="font-medium">{UNIT_NUMBER[u]}</span> {u}
                    </button>
                  );
                })}
              </div>

              {unitFilter.size === 0 ? (
                <p className="text-xs text-muted-foreground italic">Välj minst en enhet för att se bytesdagar.</p>
              ) : changes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Inga kommande bytesdagar för valda enheter.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {changes.map((c) => {
                    const isTodayDay = c.date.getTime() === todayRef.getTime();
                    return (
                      <li key={c.dateISO}>
                        <button
                          onClick={() => setOpenDay(c.date)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors ${
                            isTodayDay ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="w-14 shrink-0 text-center">
                            <div className={`text-[10px] uppercase font-medium ${isTodayDay ? "text-primary" : "text-muted-foreground"}`}>
                              {format(c.date, "EEE", { locale: sv })}
                            </div>
                            <div className={`text-lg font-semibold leading-tight ${isTodayDay ? "text-primary" : "text-foreground"}`}>
                              {format(c.date, "d")}
                            </div>
                            <div className="text-[10px] text-muted-foreground capitalize">
                              {format(c.date, "MMM", { locale: sv })}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1">
                              {c.units.map(({ unit }) => {
                                const s = styleFor(unit);
                                return (
                                  <span key={unit} className={`text-[11px] px-1.5 py-0.5 rounded border ${s.chip} flex items-center gap-1`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                                    {unit}
                                  </span>
                                );
                              })}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {c.units.length} byte{c.units.length === 1 ? "" : "n"} – städ behövs
                            </div>
                            {(() => {
                              const names = dayShiftsByDate?.get(c.dateISO) ?? [];
                              return (
                                <div className="text-[11px] mt-0.5 flex items-center gap-1 flex-wrap">
                                  <span className="text-muted-foreground">Dagpass:</span>
                                  {names.length > 0 ? (
                                    <span className="font-medium text-foreground">{names.join(", ")}</span>
                                  ) : (
                                    <span className="italic text-muted-foreground">ingen schemalagd</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })()}

        {/* Förklaring */}
        {unitsInMonth.length > 0 && (
          <Card className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">Uthyrningsenheter</div>
            <div className="flex flex-wrap gap-2">
              {UNIT_ORDER.map((u) => {
                const s = styleFor(u);
                return (
                  <span key={u} className={`text-xs px-2 py-1 rounded-full border ${s.chip} flex items-center gap-1.5`}>
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <span className="font-medium">{UNIT_NUMBER[u]}</span> {u}
                  </span>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <div className="text-xs font-semibold mb-2">Så läser du kalendern</div>
              <div className="flex flex-col gap-2 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-4 rounded-r-sm bg-muted-foreground/50 shrink-0" />
                  Halv stapel på vänster sida = gästen <strong className="text-foreground font-medium mx-1">åker hem</strong> den dagen
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-4 rounded-l-sm bg-muted-foreground/50 shrink-0 ml-4" />
                  Halv stapel på höger sida = gästen <strong className="text-foreground font-medium mx-1">checkar in</strong> den dagen
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-8 bg-muted-foreground/50 shrink-0" />
                  Hel stapel = gästen <strong className="text-foreground font-medium mx-1">bor över</strong> natten till nästa dag
                </span>
              </div>
              <div className="mt-3 p-2 rounded-md bg-primary/5 border border-primary/20 text-[12px] text-foreground">
                <strong>Kom ihåg:</strong> Avfärd senast kl 11:00 · Ankomst tidigast kl 15:00
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Dialog: dagens händelser */}
      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden flex flex-col
                     h-[100dvh] w-screen max-w-none rounded-none border-0 translate-x-0 translate-y-0 top-0 left-0
                     sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:w-full sm:rounded-lg sm:border sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                     [&>button.absolute]:hidden"
        >
          {openDay && (() => {
            const dayEvents = eventsForDay(openDay);
            const arrivals = dayEvents.filter((e) => {
              const r = roleForDay(e, openDay);
              return r === "start" || r === "single";
            });
            const departures = dayEvents.filter((e) => roleForDay(e, openDay) === "end");
            const ongoing = dayEvents.filter((e) => roleForDay(e, openDay) === "middle");
            // "Kan tillkomma" endast för framtida dagar och endast om natten
            // dagen innan är ledig (avfärd på D-1 räknas som ledig natt).
            const todayRef = new Date();
            todayRef.setHours(0, 0, 0, 0);
            const openRef = new Date(openDay);
            openRef.setHours(0, 0, 0, 0);
            const prev = addDays(openRef, -1);
            const ongoingUnits = new Set(ongoing.map((e) => e.unit));
            const potentialUnits = openRef > todayRef
              ? UNIT_ORDER.filter((u) => {
                  if (ongoingUnits.has(u)) return false;
                  for (const e of events) {
                    if (e.unit !== u) continue;
                    const s = parseISO(e.start);
                    const en = parseISO(e.end); // exklusiv
                    if (s <= prev && en > prev) return false;
                  }
                  return true;
                })
              : [];

            const renderCard = (e: LodgeEvent, badge?: { text: string; cls: string }) => {
              const s = styleFor(e.unit);
              const endInclusive = addDays(parseISO(e.end), -1);
              const sameDay = e.start === format(endInclusive, "yyyy-MM-dd");
              return (
                <div key={e.uid + e.start} className={`relative p-3 pr-3 rounded-lg border ${s.chip}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.dot} shrink-0`} />
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
                  <div className="text-sm">{e.summary}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {e.allDay ? (
                      sameDay ? <>Hela dagen</> : (
                        <>
                          {format(parseISO(e.start), "d MMM", { locale: sv })} –{" "}
                          {format(endInclusive, "d MMM", { locale: sv })}
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
              <div className="flex items-center justify-between mt-3 mb-2 first:mt-0">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </div>
            );

            return (
              <>
                {/* Header med dag + navigering + stäng */}
                <DialogHeader className="shrink-0 bg-background border-b border-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => setOpenDay(addDays(openDay, -1))}
                      aria-label="Föregående dag"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <DialogTitle className="capitalize text-center text-base flex-1 min-w-0 truncate">
                      {format(openDay, "EEEE d MMMM", { locale: sv })}
                    </DialogTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => setOpenDay(addDays(openDay, 1))}
                      aria-label="Nästa dag"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 ml-1 rounded-full bg-muted/60 hover:bg-muted"
                      onClick={() => setOpenDay(null)}
                      aria-label="Stäng"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </DialogHeader>


                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {dayEvents.length === 0 && potentialUnits.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Inga bokningar denna dag.

                    </p>
                  )}

                  {departures.length > 0 && (
                    <>
                      <SectionHeader title="Avfärd" count={departures.length} />
                      <div className="space-y-2">
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
                      <div className="space-y-2">
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
                      <div className="space-y-2">{ongoing.map((e) => renderCard(e))}</div>
                    </>
                  )}


                  {potentialUnits.length > 0 && (
                    <>
                      <SectionHeader title="Kan tillkomma vid sen bokning" count={potentialUnits.length} />
                      <div className="space-y-2">
                        {potentialUnits.map((u) => {
                          const s = styleFor(u);
                          return (
                            <div
                              key={u}
                              className={`p-3 rounded-lg border-2 border-dashed ${s.chip} opacity-90`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-2.5 w-2.5 rounded-full ${s.dot} shrink-0`} />
                                  <span className="text-sm font-semibold truncate">
                                    {UNIT_NUMBER[u]} {u}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-800 border-orange-200 whitespace-nowrap">
                                  Kan tillkomma
                                </span>



                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Ej bokad ännu – kan få en sen bokning med avfärd denna dag.
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                        En gäst kan boka kvällen före och då tillkommer bytesdag/städ. Var beredd.
                      </p>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Lodge;
