import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Users, CalendarDays, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, addDays, formatDistanceToNowStrict, addWeeks, getISOWeek, isSameWeek } from "date-fns";
import { sv } from "date-fns/locale";

interface AdminOverviewProps {
  onNavigate: (tab: string) => void;
}

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const SHIFT_EMOJI: Record<string, string> = {
  morning: "🌅",
  day: "☀️",
  evening: "🌙",
  busy: "🔒",
  off: "💤",
};

// Shared section palette (matches the four stat cards above)
const SECTION_STYLE = {
  active: {
    tint: "bg-[hsl(183_25%_96%)] border-[hsl(183_25%_88%)]",
    iconBg: "bg-[hsl(183_25%_90%)]",
    iconColor: "text-[hsl(183_25%_35%)]",
    avatarBg: "bg-[hsl(183_25%_88%)]",
    avatarText: "text-[hsl(183_25%_28%)]",
    divide: "divide-[hsl(183_25%_88%)]",
    dot: "bg-[hsl(183_25%_38%)]",
  },
  today: {
    tint: "bg-[hsl(38_60%_96%)] border-[hsl(38_60%_88%)]",
    iconBg: "bg-[hsl(38_60%_90%)]",
    iconColor: "text-[hsl(32_55%_38%)]",
    avatarBg: "bg-[hsl(38_60%_88%)]",
    avatarText: "text-[hsl(32_55%_30%)]",
    divide: "divide-[hsl(38_60%_88%)]",
    dot: "bg-[hsl(32_55%_45%)]",
  },
  week: {
    tint: "bg-[hsl(150_25%_96%)] border-[hsl(150_25%_88%)]",
    iconBg: "bg-[hsl(150_25%_90%)]",
    iconColor: "text-[hsl(150_30%_32%)]",
    avatarBg: "bg-[hsl(150_25%_88%)]",
    avatarText: "text-[hsl(150_30%_25%)]",
    divide: "divide-[hsl(150_25%_88%)]",
    dot: "bg-[hsl(150_30%_38%)]",
  },
};

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const getShortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}`;
};

const AdminOverview = ({ onNavigate }: AdminOverviewProps) => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const [weekOffset, setWeekOffset] = useState(0);
  const baseWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addWeeks(baseWeekStart, weekOffset);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = weekOffset === 0;
  const weekNumber = getISOWeek(weekStart);


  const { data: pendingCorrections = [], isLoading: loadingCorrections } = useQuery({
    queryKey: ["pending-corrections-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_correction_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const { data: activeEntries = [], isLoading: loadingActive } = useQuery({
    queryKey: ["active-entries-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .is("clock_out", null)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const { data: workers = [], isLoading: loadingWorkers } = useQuery({
    queryKey: ["workers-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: todayShifts = [], isLoading: loadingToday } = useQuery({
    queryKey: ["overview-today-shifts", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("date", todayStr);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const { data: weekShifts = [], isLoading: loadingWeek } = useQuery({
    queryKey: ["overview-week-shifts", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const workerByUserId = new Map<string, any>();
  (workers as any[]).forEach((w) => {
    if (w.user_id) workerByUserId.set(w.user_id, w);
  });

  // Today's shifts grouped per user_id (sorted, excluding "off")
  const SHIFT_ORDER: Record<string, number> = { morning: 0, day: 1, evening: 2, busy: 3, off: 4 };
  const todayShiftsByUser = new Map<string, string[]>();
  (todayShifts as any[])
    .filter((s) => s.shift_type !== "off")
    .forEach((s) => {
      if (!todayShiftsByUser.has(s.user_id)) todayShiftsByUser.set(s.user_id, []);
      todayShiftsByUser.get(s.user_id)!.push(s.shift_type);
    });
  todayShiftsByUser.forEach((arr) =>
    arr.sort((a, b) => (SHIFT_ORDER[a] ?? 99) - (SHIFT_ORDER[b] ?? 99)),
  );
  const todayWorkers = Array.from(todayShiftsByUser.keys())
    .map((uid) => ({ worker: workerByUserId.get(uid), shifts: todayShiftsByUser.get(uid)! }))
    .filter((r) => r.worker)
    .sort((a, b) => a.worker.name.localeCompare(b.worker.name, "sv"));

  // Week shifts grouped per user → map of dayIdx → shift_types[]
  const weekByUser = new Map<string, Map<number, string[]>>();
  (weekShifts as any[]).forEach((s) => {
    if (s.shift_type === "off") return;
    const dayIdx = weekDays.findIndex((d) => format(d, "yyyy-MM-dd") === s.date);
    if (dayIdx === -1) return;
    if (!weekByUser.has(s.user_id)) weekByUser.set(s.user_id, new Map());
    const dayMap = weekByUser.get(s.user_id)!;
    if (!dayMap.has(dayIdx)) dayMap.set(dayIdx, []);
    dayMap.get(dayIdx)!.push(s.shift_type);
  });
  weekByUser.forEach((dayMap) =>
    dayMap.forEach((arr) =>
      arr.sort((a, b) => (SHIFT_ORDER[a] ?? 99) - (SHIFT_ORDER[b] ?? 99)),
    ),
  );
  const weekRows = Array.from(weekByUser.entries())
    .map(([uid, dayMap]) => ({
      worker: workerByUserId.get(uid),
      days: Array.from(dayMap.entries())
        .map(([dayIdx, shifts]) => ({ dayIdx, shifts }))
        .sort((a, b) => a.dayIdx - b.dayIdx),
    }))
    .filter((r) => r.worker)
    .sort((a, b) => a.worker.name.localeCompare(b.worker.name, "sv"));

  const stats = [
    {
      key: "active",
      label: "Instämplade nu",
      value: loadingActive ? "…" : activeEntries.length,
      icon: Clock,
      // teal
      tint: "bg-[hsl(183_25%_96%)] border-[hsl(183_25%_88%)]",
      iconBg: "bg-[hsl(183_25%_90%)]",
      iconColor: "text-[hsl(183_25%_35%)]",
      valueColor: "text-[hsl(183_25%_28%)]",
    },
    {
      key: "today",
      label: "Jobbar idag",
      value: loadingToday || loadingWorkers ? "…" : todayWorkers.length,
      icon: Users,
      // soft amber
      tint: "bg-[hsl(38_60%_96%)] border-[hsl(38_60%_88%)]",
      iconBg: "bg-[hsl(38_60%_90%)]",
      iconColor: "text-[hsl(32_55%_38%)]",
      valueColor: "text-[hsl(32_55%_30%)]",
    },
    {
      key: "week",
      label: "Jobbar i veckan",
      value: loadingWeek || loadingWorkers ? "…" : weekRows.length,
      icon: CalendarDays,
      // soft sage
      tint: "bg-[hsl(150_25%_96%)] border-[hsl(150_25%_88%)]",
      iconBg: "bg-[hsl(150_25%_90%)]",
      iconColor: "text-[hsl(150_30%_32%)]",
      valueColor: "text-[hsl(150_30%_25%)]",
    },
    {
      key: "corrections",
      label: "Väntande rättelser",
      value: loadingCorrections ? "…" : pendingCorrections.length,
      icon: AlertTriangle,
      onClick: () => onNavigate("rattelser"),
      // soft rose
      tint: "bg-[hsl(8_55%_97%)] border-[hsl(8_55%_88%)]",
      iconBg: "bg-[hsl(8_55%_92%)]",
      iconColor: "text-[hsl(8_55%_42%)]",
      valueColor: "text-[hsl(8_55%_35%)]",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Översikt</h2>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          const Wrapper: any = s.onClick ? "button" : "div";
          return (
            <Wrapper
              key={s.key}
              onClick={s.onClick}
              className={`text-left border rounded-2xl p-4 ${s.tint} ${
                s.onClick ? "transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] cursor-pointer" : ""
              }`}
            >
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.iconBg} mb-3`}>
                <Icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-2xl font-semibold tabular-nums mt-0.5 ${s.valueColor}`}>{s.value}</p>
              {s.onClick && (
                <p className="text-[11px] text-muted-foreground mt-1.5">Hantera →</p>
              )}
            </Wrapper>
          );
        })}
      </div>

      {/* Section: Currently clocked in (teal) */}
      <section className={`border rounded-2xl p-5 space-y-4 ${SECTION_STYLE.active.tint}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${SECTION_STYLE.active.iconBg}`}>
              <Clock className={`h-3.5 w-3.5 ${SECTION_STYLE.active.iconColor}`} />
            </div>
            <h3 className="text-base font-semibold text-foreground">Instämplade nu</h3>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {loadingActive ? "" : `${activeEntries.length} st`}
          </span>
        </div>

        {loadingActive ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : activeEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Ingen är instämplad just nu.</p>
        ) : (
          <ul className={`divide-y ${SECTION_STYLE.active.divide}`}>
            {(activeEntries as any[]).map((entry) => {
              const since = entry.clock_in ? new Date(entry.clock_in) : null;
              const hoursSince = since ? (Date.now() - since.getTime()) / 3600000 : 0;
              const warning = hoursSince > 5;
              return (
                <li key={entry.id} className="py-2.5 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-xs font-semibold ${SECTION_STYLE.active.avatarBg} ${SECTION_STYLE.active.avatarText}`}>
                      {getInitials(entry.worker_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.worker_name}
                      </p>
                      {warning && (
                        <span title="Instämplad mer än 5 timmar" aria-label="Långt pass">
                          ⚠️
                        </span>
                      )}
                    </div>
                    {since && (
                      <p className="text-xs text-muted-foreground">
                        Sedan {format(since, "HH:mm", { locale: sv })} ·{" "}
                        {formatDistanceToNowStrict(since, { locale: sv })}
                      </p>
                    )}
                  </div>
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${SECTION_STYLE.active.dot}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${SECTION_STYLE.active.dot}`} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section: Working today (amber) */}
      <section className={`border rounded-2xl p-5 space-y-4 ${SECTION_STYLE.today.tint}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${SECTION_STYLE.today.iconBg}`}>
              <Users className={`h-3.5 w-3.5 ${SECTION_STYLE.today.iconColor}`} />
            </div>
            <h3 className="text-base font-semibold text-foreground">Jobbar idag</h3>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {loadingToday || loadingWorkers ? "" : `${todayWorkers.length} st`}
          </span>
        </div>

        {loadingToday || loadingWorkers ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : todayWorkers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Ingen är schemalagd idag.</p>
        ) : (
          <ul className={`divide-y ${SECTION_STYLE.today.divide}`}>
            {todayWorkers.map((row) => (
              <li key={row.worker.id} className="py-2.5 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className={`text-xs font-semibold ${SECTION_STYLE.today.avatarBg} ${SECTION_STYLE.today.avatarText}`}>
                    {getInitials(row.worker.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-foreground truncate flex-1">
                  {row.worker.name}
                </p>
                <span className="text-base leading-none tabular-nums" aria-label="Pass">
                  {row.shifts.map((t) => SHIFT_EMOJI[t] ?? "").join(" ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section: Working this week (sage) */}
      <section className={`border rounded-2xl p-5 space-y-4 ${SECTION_STYLE.week.tint}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${SECTION_STYLE.week.iconBg}`}>
              <CalendarDays className={`h-3.5 w-3.5 ${SECTION_STYLE.week.iconColor}`} />
            </div>
            <h3 className="text-base font-semibold text-foreground truncate">
              {isCurrentWeek ? "Jobbar denna vecka" : `Vecka ${weekNumber}`}
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
              {format(weekStart, "d MMM", { locale: sv })} – {format(weekEnd, "d MMM", { locale: sv })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o - 1)}
              aria-label="Föregående vecka"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setWeekOffset(0)}
              >
                Denna vecka
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label="Nästa vecka"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loadingWeek || loadingWorkers ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : weekRows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Ingen är schemalagd denna vecka.</p>
        ) : (
          <ul className={`divide-y ${SECTION_STYLE.week.divide}`}>
            {weekRows.map((row) => (
              <li key={row.worker.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground truncate shrink-0">
                  {getShortName(row.worker.name)}
                </span>
                <span className="text-xs text-muted-foreground text-right">
                  {row.days.map((d, i) => (
                    <span key={d.dayIdx}>
                      {i > 0 && <span className="mx-1 opacity-50">·</span>}
                      {DAY_NAMES[d.dayIdx]}{" "}
                      <span className="text-sm leading-none">
                        {d.shifts.map((t) => SHIFT_EMOJI[t] ?? "").join("")}
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AdminOverview;
