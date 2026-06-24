import { useState, useMemo } from "react";
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
import { ChevronLeft, ChevronRight, ArrowLeft, RefreshCw, Home, Calendar as CalendarIcon } from "lucide-react";
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

  const canAccess = isAdmin || worker?.can_see_lodge === true;
  const ready = !workerLoading && !adminLoading;

  const { data, isLoading, refetch, isFetching, error } = useQuery({
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
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Uppdatera">
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
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setOpenDay(day)}
                    className={`min-h-[92px] md:min-h-[112px] p-1 border-r border-b border-border text-left transition-colors flex flex-col ${
                      today
                        ? "bg-primary/5"
                        : inMonth
                        ? "bg-card hover:bg-accent"
                        : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div className={`text-[11px] md:text-xs font-medium mb-1 ${today ? "text-primary" : ""}`}>
                      {format(day, "d")}
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
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-l-sm bg-muted-foreground/40" />
                Avfärd (förmiddag)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-r-sm bg-muted-foreground/40" />
                Ankomst (eftermiddag)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-6 bg-muted-foreground/40" />
                Vistelse (natt)
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Dialog: dagens händelser */}
      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {openDay && format(openDay, "EEEE d MMMM yyyy", { locale: sv })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {openDay && eventsForDay(openDay).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Inga bokningar denna dag.
              </p>
            )}
            {openDay && eventsForDay(openDay).map((e) => {
              const s = styleFor(e.unit);
              const endInclusive = addDays(parseISO(e.end), -1);
              const sameDay = e.start === format(endInclusive, "yyyy-MM-dd");
              const role = roleForDay(e, openDay!);
              const roleLabel =
                role === "start" ? "Ankomst (eftermiddag)" :
                role === "end"   ? "Avfärd (förmiddag)"   :
                role === "single" ? "Hela dagen" :
                "Pågående vistelse";
              return (
                <div key={e.uid + e.start} className={`p-3 rounded-lg border ${s.chip}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                    <span className="text-sm font-semibold">
                      {UNIT_NUMBER[e.unit] ? `${UNIT_NUMBER[e.unit]} ` : ""}{e.unit}
                    </span>
                  </div>
                  <div className="text-xs font-medium mb-1">{roleLabel}</div>
                  <div className="text-sm">{e.summary}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {e.allDay ? (
                      sameDay ? (
                        <>Hela dagen</>
                      ) : (
                        <>
                          {format(parseISO(e.start), "d MMM", { locale: sv })} –{" "}
                          {format(endInclusive, "d MMM", { locale: sv })}
                        </>
                      )
                    ) : (
                      <>
                        {e.startTime} {e.endTime ? `– ${e.endTime}` : ""}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Lodge;
