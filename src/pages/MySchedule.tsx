import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek, isToday, isSameWeek, addDays } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ShiftChecklistViewer from "@/components/ShiftChecklistViewer";
import { useTodayChecklistStatus } from "@/hooks/useTodayChecklistStatus";
import { CheckCircle2, ListChecks } from "lucide-react";

type ShiftType = "morning" | "day" | "evening" | "busy" | "off" | "fishing" | "clearing";

const SHIFT_CONFIG: Record<ShiftType, { emoji: string; label: string; bg: string; border: string; text: string }> = {
  morning: { emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  day: { emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  evening: { emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  busy: { emoji: "🚫", label: "Ej tillg.", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  fishing: { emoji: "🎣", label: "Fiske", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  clearing: { emoji: "🌲", label: "Röja", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  off: { emoji: "💤", label: "Ledigt", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400" },
};

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const MySchedule = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: worker } = useWorker(user?.id);
  const { data: checklistStatus } = useTodayChecklistStatus(user?.id);
  const [weekOffset, setWeekOffset] = useState(0);
  const [openShift, setOpenShift] = useState<{ id: string; label: string; date: Date } | null>(null);
  const [upcomingCollapsed, setUpcomingCollapsed] = useState(false);
  const upcomingListRef = useRef<HTMLDivElement | null>(null);
  const savedScrollRef = useRef<{ window: number; list: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const referenceDate = useMemo(() => {
    const now = new Date();
    if (weekOffset === 0) return now;
    return weekOffset > 0 ? addWeeks(now, weekOffset) : subWeeks(now, Math.abs(weekOffset));
  }, [weekOffset]);

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(referenceDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 });

  const { data: allWorkers = [] } = useQuery({
    queryKey: ["all-workers-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: scheduleDays = [] } = useQuery({
    queryKey: ["schedule-days", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_days")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch checklist counts for MY shifts this week
  const myShiftIds = useMemo(
    () => schedules.filter((s: any) => s.user_id === user?.id).map((s: any) => s.id),
    [schedules, user?.id]
  );

  const { data: checklistCounts = {} } = useQuery({
    queryKey: ["my-shift-checklist-counts", myShiftIds.join(",")],
    queryFn: async () => {
      if (myShiftIds.length === 0) return {};
      const { data, error } = await supabase
        .from("shift_checklists")
        .select("id, shift_id")
        .in("shift_id", myShiftIds);
      if (error) throw error;
      return (data || []).reduce((acc: Record<string, number>, c) => {
        acc[c.shift_id] = (acc[c.shift_id] || 0) + 1;
        return acc;
      }, {});
    },
    enabled: myShiftIds.length > 0,
  });

  const myUserId = user?.id;

  // Upcoming shifts (next 60 days, independent of weekOffset)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const upcomingEnd = useMemo(() => addDays(today, 60), [today]);

  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ["upcoming-shifts", myUserId, format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!myUserId) return [];
      const fromStr = format(today, "yyyy-MM-dd");
      const toStr = format(upcomingEnd, "yyyy-MM-dd");
      const [shiftsRes, daysRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("*")
          .eq("user_id", myUserId)
          .gte("date", fromStr)
          .lte("date", toStr)
          .order("date", { ascending: true })
          .order("shift_index", { ascending: true }),
        supabase
          .from("schedule_days")
          .select("date,is_published")
          .gte("date", fromStr)
          .lte("date", toStr),
      ]);
      if (shiftsRes.error) throw shiftsRes.error;
      if (daysRes.error) throw daysRes.error;
      const publishedDates = new Set(
        (daysRes.data || []).filter((d: any) => d.is_published === true).map((d: any) => d.date)
      );
      const filtered = (shiftsRes.data || []).filter((s: any) => publishedDates.has(s.date));
      // Group by date
      const byDate: Record<string, any[]> = {};
      filtered.forEach((s: any) => {
        if (!byDate[s.date]) byDate[s.date] = [];
        byDate[s.date].push(s);
      });
      return Object.entries(byDate)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, shifts]) => ({ date, shifts }));
    },
    enabled: !!myUserId,
  });

  const upcomingShiftIds = useMemo(
    () => upcoming.flatMap((d: any) => d.shifts.map((s: any) => s.id)),
    [upcoming]
  );

  const { data: upcomingChecklistCounts = {} } = useQuery({
    queryKey: ["upcoming-shift-checklist-counts", upcomingShiftIds.join(",")],
    queryFn: async () => {
      if (upcomingShiftIds.length === 0) return {};
      const { data, error } = await supabase
        .from("shift_checklists")
        .select("id, shift_id")
        .in("shift_id", upcomingShiftIds);
      if (error) throw error;
      return (data || []).reduce((acc: Record<string, number>, c) => {
        acc[c.shift_id] = (acc[c.shift_id] || 0) + 1;
        return acc;
      }, {});
    },
    enabled: upcomingShiftIds.length > 0,
  });

  const isDayPublished = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const row = scheduleDays.find((d: any) => d.date === dateStr);
    return row?.is_published === true;
  };

  const getShiftAt = (userId: string, date: Date, idx: 0 | 1) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.find(
      (s: any) => s.user_id === userId && s.date === dateStr && (s.shift_index ?? 0) === idx,
    );
  };

  const canSeeTeam = worker?.can_see_team === true;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={{ colorScheme: "light" }}>
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  const Chip = ({
    shift,
    full,
    hasChecklist,
    onClick,
  }: {
    shift: ShiftType;
    full?: boolean;
    hasChecklist?: boolean;
    onClick?: () => void;
  }) => {
    const cfg = SHIFT_CONFIG[shift];
    const interactive = !!onClick && !!hasChecklist;
    return (
      <button
        type="button"
        onClick={interactive ? onClick : undefined}
        disabled={!interactive}
        className={`relative w-full rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-center px-1 ${
          full ? "flex-1 py-2" : "py-1"
        } ${interactive ? "cursor-pointer hover:brightness-95 transition" : "cursor-default"}`}
      >
        <span className={`leading-none ${full ? "text-base" : "text-sm"}`}>{cfg.emoji}</span>
        <span className={`font-semibold mt-0.5 ${cfg.text} text-[10px]`}>{cfg.label}</span>
      </button>
    );
  };

  const DayCell = ({
    userId,
    date,
    today,
    isMine,
  }: {
    userId: string | null | undefined;
    date: Date;
    today: boolean;
    isMine: boolean;
  }) => {
    const published = isDayPublished(date);

    if (!published) {
      return (
        <div
          className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 min-h-[68px] px-1 ${
            today ? "ring-2 ring-primary" : ""
          }`}
        >
          <span className="text-[10px] font-semibold text-muted-foreground">Ej publicerat</span>
        </div>
      );
    }

    const e0 = userId ? getShiftAt(userId, date, 0) : null;
    const e1 = userId ? getShiftAt(userId, date, 1) : null;
    const hasAny = !!e0 || !!e1;
    const onlyOne = hasAny && !(e0 && e1);

    if (!hasAny) {
      return (
        <div
          className={`flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 min-h-[68px] ${
            today ? "ring-2 ring-primary" : ""
          }`}
        >
          <span className="text-xs text-gray-300">–</span>
        </div>
      );
    }

    const renderChip = (entry: any, full: boolean) => {
      const has = isMine && (checklistCounts[entry.id] || 0) > 0;
      return (
        <Chip
          shift={entry.shift_type as ShiftType}
          full={full}
          hasChecklist={has}
          onClick={
            has
              ? () =>
                  setOpenShift({
                    id: entry.id,
                    label: SHIFT_CONFIG[entry.shift_type as ShiftType].label,
                    date,
                  })
              : undefined
          }
        />
      );
    };

    return (
      <div className={`flex flex-col gap-1 min-h-[68px] rounded-xl ${today ? "ring-2 ring-primary" : ""}`}>
        {e0 && renderChip(e0, onlyOne)}
        {e1 && renderChip(e1, onlyOne)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-5">
        {checklistStatus?.hasShifts && checklistStatus.total > 0 && (
          checklistStatus.unchecked > 0 ? (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2.5">
              <div className="text-xs text-yellow-800 leading-snug">
                Du har <span className="font-semibold">{checklistStatus.unchecked}</span> obockade punkter på dagens pass. Glöm inte att bocka av allt innan du stämplar ut.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-green-300 bg-green-50 px-3 py-2.5">
              <div className="text-xs text-green-800 leading-snug">
                Bra jobbat! Alla punkter på dagens pass är avbockade.
              </div>
            </div>
          )
        )}

        {/* MIN VECKA */}
        <div className="space-y-4">
          {/* Back button */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Min vecka</h2>
          </div>
          <div className="flex items-center justify-between gap-2 min-h-[28px]">
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors shrink-0"
              >
                <ArrowLeft className="h-3 w-3" />
                Tillbaka till idag
              </button>
            )}
          </div>

          {/* Week navigator */}
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">Vecka {weekNumber}</div>
              <div className="text-xs text-muted-foreground">
                {format(weekStart, "d MMM", { locale: sv })} – {format(weekEnd, "d MMM", { locale: sv })} · {format(weekStart, "yyyy")}
              </div>
            </div>
            <button onClick={() => setWeekOffset((o) => o + 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Day strip */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((d, i) => {
              const today = isToday(d);
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{DAY_NAMES[i]}</span>
                  <span className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                    {format(d, "d")}
                  </span>
                </div>
              );
            })}
          </div>

          {schedulesLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d, i) => (
                <DayCell key={i} userId={myUserId} date={d} today={isToday(d)} isMine={true} />
              ))}
            </div>
          )}

          {/* KOMMANDE PASS */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => setUpcomingCollapsed((v) => !v)}
              className="w-full flex items-center justify-between gap-2 group"
              aria-expanded={!upcomingCollapsed}
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Kommande pass
              </h3>
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-border text-muted-foreground group-hover:bg-muted transition-colors">
                {upcomingCollapsed ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              </span>
            </button>
            {!upcomingCollapsed && (
              upcomingLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : upcoming.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center">
                  <span className="text-xs text-muted-foreground">Inga kommande pass schemalagda</span>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-2xl border border-border bg-card divide-y divide-border">
                  {upcoming.map(({ date, shifts }: { date: string; shifts: any[] }, idx: number) => {
                    const dateObj = new Date(date + "T00:00:00");
                    const wk = getISOWeek(dateObj);
                    const prevWk =
                      idx > 0 ? getISOWeek(new Date(upcoming[idx - 1].date + "T00:00:00")) : null;
                    const showWeekDivider = prevWk !== null && wk !== prevWk;
                    const shiftsWithChecklist = shifts.filter(
                      (s: any) => (upcomingChecklistCounts[s.id] || 0) > 0
                    );
                    const rowClickable = shiftsWithChecklist.length === 1;
                    const rowOpen = rowClickable
                      ? () =>
                          setOpenShift({
                            id: shiftsWithChecklist[0].id,
                            label:
                              SHIFT_CONFIG[shiftsWithChecklist[0].shift_type as ShiftType].label,
                            date: dateObj,
                          })
                      : undefined;
                    return (
                      <div key={date}>
                        {showWeekDivider && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-muted/30">
                            <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
                              v {wk}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                        )}
                        <div
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                            rowClickable
                              ? "cursor-pointer hover:bg-muted/40 transition-colors"
                              : ""
                          }`}
                          onClick={rowOpen}
                          role={rowClickable ? "button" : undefined}
                          tabIndex={rowClickable ? 0 : undefined}
                          onKeyDown={
                            rowClickable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    rowOpen?.();
                                  }
                                }
                              : undefined
                          }
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-foreground capitalize truncate">
                              {format(dateObj, "EEEE", { locale: sv })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(dateObj, "d MMMM", { locale: sv })}
                            </span>
                          </div>
                          <div className="flex gap-1.5 shrink-0 w-[160px]">
                            {shifts.map((entry) => {
                              const has = (upcomingChecklistCounts[entry.id] || 0) > 0;
                              return (
                                <div key={entry.id} className="flex-1">
                                  <Chip
                                    shift={entry.shift_type as ShiftType}
                                    full
                                    hasChecklist={has}
                                    onClick={
                                      has
                                        ? (e?: any) => {
                                            e?.stopPropagation?.();
                                            setOpenShift({
                                              id: entry.id,
                                              label: SHIFT_CONFIG[entry.shift_type as ShiftType].label,
                                              date: dateObj,
                                            });
                                          }
                                        : undefined
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* HELA TEAMET */}
        {canSeeTeam && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Teamets vecka</h2>
            <div className="space-y-3">
              {allWorkers.filter((w: any) => w.user_id && w.user_id !== myUserId).map((w: any) => (
                <Card key={w.id} className="p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(w.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-foreground">{w.name}</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map((d, i) => (
                      <DayCell key={i} userId={w.user_id} date={d} today={isToday(d)} isMine={false} />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!openShift} onOpenChange={(o) => !o && setOpenShift(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85vh] overflow-y-auto data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[state=open]:ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => {
              const el = e.currentTarget as HTMLElement | null;
              el?.scrollIntoView({ behavior: "smooth", block: "end" });
              el?.scrollTo?.({ top: 0, behavior: "smooth" });
            });
          }}
        >
          <SheetHeader className="text-left">
            <SheetTitle>
              {openShift?.label} · {openShift && format(openShift.date, "EEEE d MMM", { locale: sv })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {openShift && <ShiftChecklistViewer shiftId={openShift.id} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MySchedule;
