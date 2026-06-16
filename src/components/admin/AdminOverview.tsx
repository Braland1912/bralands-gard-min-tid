import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Users, CalendarDays, Clock, ChevronLeft, ChevronRight, Check, Circle, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import EveningRoundWidget from "@/components/admin/EveningRoundWidget";
import { format, startOfWeek, endOfWeek, addDays, formatDistanceToNowStrict, addWeeks, getISOWeek, isSameWeek, isToday } from "date-fns";
import { sv } from "date-fns/locale";
import VersionTag from "@/components/VersionTag";

interface AdminOverviewProps {
  onNavigate: (tab: string) => void;
}

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const SHIFT_EMOJI: Record<string, string> = {
  morning: "🌅",
  day: "☀️",
  evening: "🌙",
  busy: "🚫",
  fishing: "🎣",
  clearing: "🚜",
  off: "💤",
};

const SHIFT_CHIP: Record<string, { emoji: string; label: string; bg: string; border: string; text: string }> = {
  morning: { emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  day: { emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  evening: { emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  busy: { emoji: "🚫", label: "Ej tillg.", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  fishing: { emoji: "🎣", label: "Guidning", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
  clearing: { emoji: "🚜", label: "Gården", bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
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
  const [selectedWorker, setSelectedWorker] = useState<{ worker: any; shiftIds: string[] } | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"today" | "week" | "all">("all");
  const normalizedSearch = search.trim().toLocaleLowerCase("sv");
  const matchesSearch = (name: string | undefined | null) =>
    !normalizedSearch || (name ?? "").toLocaleLowerCase("sv").includes(normalizedSearch);
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
    refetchInterval: 15000,
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
    refetchInterval: 15000,
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

  // Today's shift IDs for checklist lookup
  const todayShiftIds = (todayShifts as any[])
    .filter((s) => s.shift_type !== "off")
    .map((s) => s.id);

  const { data: todayChecklistData } = useQuery({
    queryKey: ["overview-today-checklists", todayStr, todayShiftIds.sort().join(",")],
    enabled: todayShiftIds.length > 0,
    queryFn: async () => {
      const { data: cls, error } = await supabase
        .from("shift_checklists")
        .select("id, name, shift_id, sort_order")
        .in("shift_id", todayShiftIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      if (!cls || cls.length === 0) return { lists: [], items: [] };
      const { data: items, error: e2 } = await supabase
        .from("shift_checklist_items")
        .select("id, shift_checklist_id, text, is_checked, sort_order")
        .in("shift_checklist_id", cls.map((c) => c.id))
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      return { lists: cls, items: items ?? [] };
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
  const todayShiftIdsByUser = new Map<string, string[]>();
  (todayShifts as any[])
    .filter((s) => s.shift_type !== "off" && s.shift_type !== "busy")
    .forEach((s) => {
      if (!todayShiftsByUser.has(s.user_id)) todayShiftsByUser.set(s.user_id, []);
      todayShiftsByUser.get(s.user_id)!.push(s.shift_type);
      if (!todayShiftIdsByUser.has(s.user_id)) todayShiftIdsByUser.set(s.user_id, []);
      todayShiftIdsByUser.get(s.user_id)!.push(s.id);
    });
  todayShiftsByUser.forEach((arr) =>
    arr.sort((a, b) => (SHIFT_ORDER[a] ?? 99) - (SHIFT_ORDER[b] ?? 99)),
  );
  const todayWorkers = Array.from(todayShiftsByUser.keys())
    .map((uid) => ({
      worker: workerByUserId.get(uid),
      shifts: todayShiftsByUser.get(uid)!,
      shiftIds: todayShiftIdsByUser.get(uid) ?? [],
    }))
    .filter((r) => r.worker)
    .sort((a, b) => {
      const aFirst = SHIFT_ORDER[a.shifts[0]] ?? 99;
      const bFirst = SHIFT_ORDER[b.shifts[0]] ?? 99;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return a.worker.name.localeCompare(b.worker.name, "sv");
    });

  // Compute checklist progress per user for today
  const checklistProgressByUser = new Map<string, { done: number; total: number }>();
  if (todayChecklistData) {
    const { lists, items } = todayChecklistData;
    const listsByShift = new Map<string, string[]>();
    (lists as any[]).forEach((l) => {
      if (!listsByShift.has(l.shift_id)) listsByShift.set(l.shift_id, []);
      listsByShift.get(l.shift_id)!.push(l.id);
    });
    todayWorkers.forEach((row) => {
      const listIds: string[] = [];
      row.shiftIds.forEach((sid) => {
        const lids = listsByShift.get(sid);
        if (lids) listIds.push(...lids);
      });
      if (listIds.length === 0) return;
      const relItems = (items as any[]).filter((i) => listIds.includes(i.shift_checklist_id));
      if (relItems.length === 0) return;
      const done = relItems.filter((i) => i.is_checked).length;
      checklistProgressByUser.set(row.worker.user_id, { done, total: relItems.length });
    });
  }

  // Week shifts grouped per user → map of dayIdx → shift_types[]
  const weekByUser = new Map<string, Map<number, string[]>>();
  (weekShifts as any[]).forEach((s) => {
    if (s.shift_type === "off" || s.shift_type === "busy") return;
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
    .sort((a, b) => {
      const aFirst = a.days[0]?.dayIdx ?? 99;
      const bFirst = b.days[0]?.dayIdx ?? 99;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return a.worker.name.localeCompare(b.worker.name, "sv");
    });

  // Apply name search filter (counters reflect filtered results)
  const filteredActiveEntries = (activeEntries as any[]).filter((e) => matchesSearch(e.worker_name));
  const filteredTodayWorkers = todayWorkers.filter((r) => matchesSearch(r.worker?.name));
  const filteredWeekRows = weekRows.filter((r) => matchesSearch(r.worker?.name));

  const showToday = scope === "today" || scope === "all";
  const showWeek = scope === "week" || scope === "all";

  const hasPendingCorrections = !loadingCorrections && pendingCorrections.length > 0;

  return (
    <div className="space-y-3 pb-24 md:pb-6">

      {/* Väntande rättelser – visas endast när det finns några */}
      {hasPendingCorrections && (
        <button
          type="button"
          onClick={() => onNavigate("rattelser")}
          className="w-full text-left border rounded-xl px-3 py-2.5 bg-[hsl(8_55%_97%)] border-[hsl(8_55%_88%)] transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-[hsl(8_55%_92%)]">
              <AlertTriangle className="h-4 w-4 text-[hsl(8_55%_42%)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground font-medium leading-tight">Väntande rättelser</p>
              <p className="text-lg font-semibold tabular-nums leading-tight text-[hsl(8_55%_35%)]">
                {pendingCorrections.length}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </button>
      )}

      {/* Kvällsrundan – snabb status */}
      <EveningRoundWidget />

      {/* Instämplade nu – combined card with names */}
      <div className={`border rounded-xl px-3 py-2.5 ${SECTION_STYLE.active.tint}`}>
        <div className="flex items-center gap-2.5">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${SECTION_STYLE.active.iconBg}`}>
            <Clock className={`h-3.5 w-3.5 ${SECTION_STYLE.active.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground font-medium leading-tight">Instämplade nu</p>
            <p className={`text-lg font-semibold tabular-nums leading-tight ${SECTION_STYLE.active.avatarText}`}>
              {loadingActive ? "…" : filteredActiveEntries.length}
            </p>
          </div>
        </div>
        {!loadingActive && filteredActiveEntries.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {filteredActiveEntries.map((entry) => {
              const since = entry.clock_in ? new Date(entry.clock_in) : null;
              const hoursSince = since ? (Date.now() - since.getTime()) / 3600000 : 0;
              const warning = hoursSince > 5;
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-1.5 rounded-lg border border-[hsl(183_25%_88%)] bg-background/70 px-2 py-1"
                  title={since ? `Sedan ${format(since, "HH:mm", { locale: sv })}` : entry.worker_name}
                >
                  <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-semibold ${SECTION_STYLE.active.avatarBg} ${SECTION_STYLE.active.avatarText}`}>
                    {getInitials(entry.worker_name || "?")}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                    {getShortName(entry.worker_name || "?")}
                  </span>
                  {warning && <span aria-label="Långt pass">⚠️</span>}
                  <span className="relative flex h-1.5 w-1.5 ml-0.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${SECTION_STYLE.active.dot}`} />
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${SECTION_STYLE.active.dot}`} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {!loadingActive && filteredActiveEntries.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground italic">
            {normalizedSearch ? "Ingen matchar din sökning." : "Ingen är instämplad just nu."}
          </p>
        )}
      </div>



      {/* Section: Working today (amber) */}
      {showToday && (
      <section className={`border rounded-2xl p-3 space-y-2.5 ${SECTION_STYLE.today.tint}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${SECTION_STYLE.today.iconBg}`}>
              <Users className={`h-3.5 w-3.5 ${SECTION_STYLE.today.iconColor}`} />
            </div>
            <h3 className="text-base font-semibold text-foreground">Jobbar idag</h3>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {loadingToday || loadingWorkers ? "" : `${filteredTodayWorkers.length} st`}
          </span>
        </div>

        {loadingToday || loadingWorkers ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : filteredTodayWorkers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {normalizedSearch ? "Ingen matchar din sökning." : "Ingen är schemalagd idag."}
          </p>
        ) : (
          <ul className={`divide-y ${SECTION_STYLE.today.divide}`}>
            {filteredTodayWorkers.map((row) => {
              const progress = checklistProgressByUser.get(row.worker.user_id);
              const pct = progress ? (progress.done / progress.total) * 100 : 0;
              const complete = progress && pct === 100;
              return (
                <li key={row.worker.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedWorker({ worker: row.worker, shiftIds: row.shiftIds })}
                    className="w-full text-left py-1.5 flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={`text-xs font-semibold ${SECTION_STYLE.today.avatarBg} ${SECTION_STYLE.today.avatarText}`}>
                        {getInitials(row.worker.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate flex-1">
                          {row.worker.name}
                        </p>
                        <span className="flex flex-wrap gap-1 justify-end shrink-0">
                          {row.shifts.map((t, idx) => {
                            const chip = SHIFT_CHIP[t];
                            if (!chip) return null;
                            return (
                              <span
                                key={`${t}-${idx}`}
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${chip.bg} ${chip.border} ${chip.text}`}
                                aria-label={`Pass: ${chip.label}`}
                              >
                                <span className="leading-none">{chip.emoji}</span>
                                <span className="leading-none">{chip.label}</span>
                              </span>
                            );
                          })}
                        </span>
                      </div>
                      {progress && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress
                            value={pct}
                            className={`h-1.5 flex-1 ${complete ? "[&>div]:bg-[hsl(150_45%_45%)]" : "[&>div]:bg-[hsl(183_30%_45%)]"}`}
                          />
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {progress.done}/{progress.total}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      {/* Section: Working this week (sage) */}
      {showWeek && (
      <section className={`border rounded-2xl p-3 space-y-2.5 ${SECTION_STYLE.week.tint}`}>
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
        ) : filteredWeekRows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {normalizedSearch ? "Ingen matchar din sökning." : "Ingen är schemalagd denna vecka."}
          </p>
        ) : (
          <ul className={`divide-y ${SECTION_STYLE.week.divide}`}>
            {filteredWeekRows.map((row) => (
              <li key={row.worker.id} className="py-1.5 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground truncate shrink-0">
                  {getShortName(row.worker.name)}
                </span>
                <div className="flex flex-wrap gap-x-2 gap-y-1 justify-end">
                  {row.days.map((d) => (
                    <div key={d.dayIdx} className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">{DAY_NAMES[d.dayIdx]}</span>
                      {d.shifts.map((t, idx) => {
                        const chip = SHIFT_CHIP[t];
                        if (!chip) return null;
                        return (
                          <span
                            key={`${t}-${idx}`}
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${chip.bg} ${chip.border} ${chip.text}`}
                            aria-label={`Pass: ${chip.label}`}
                          >
                            <span className="leading-none">{chip.emoji}</span>
                            <span className="leading-none">{chip.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Read-only checklist viewer for selected worker */}
      <Sheet open={!!selectedWorker} onOpenChange={(o) => !o && setSelectedWorker(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          {selectedWorker && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className={`text-sm font-semibold ${SECTION_STYLE.today.avatarBg} ${SECTION_STYLE.today.avatarText}`}>
                      {getInitials(selectedWorker.worker.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{selectedWorker.worker.name}</SheetTitle>
                    <p className="text-xs text-muted-foreground">
                      Checklistor {format(today, "EEEE d MMM", { locale: sv })}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {(() => {
                  if (!todayChecklistData) return <Skeleton className="h-24 w-full rounded-xl" />;
                  const { lists, items } = todayChecklistData;

                  // Worker's shifts today, in sorted order (matches chip order)
                  const workerShifts = (todayShifts as any[])
                    .filter((s) => selectedWorker.shiftIds.includes(s.id) && s.shift_type !== "off")
                    .sort(
                      (a, b) =>
                        (SHIFT_ORDER[a.shift_type] ?? 99) - (SHIFT_ORDER[b.shift_type] ?? 99),
                    );

                  const totalLists = (lists as any[]).filter((l) =>
                    selectedWorker.shiftIds.includes(l.shift_id),
                  ).length;

                  if (totalLists === 0) {
                    return (
                      <p className="text-sm text-muted-foreground italic">
                        Inga checklistor för dagen.
                      </p>
                    );
                  }

                  return workerShifts.map((shift) => {
                    const chip = SHIFT_CHIP[shift.shift_type];
                    const shiftLists = (lists as any[])
                      .filter((l) => l.shift_id === shift.id)
                      .sort((a, b) => a.sort_order - b.sort_order);

                    return (
                      <section key={shift.id} className="space-y-2">
                        {chip && (
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${chip.bg} ${chip.border} ${chip.text}`}
                            >
                              <span className="leading-none">{chip.emoji}</span>
                              <span className="leading-none">{chip.label}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {shiftLists.length} {shiftLists.length === 1 ? "checklista" : "checklistor"}
                            </span>
                          </div>
                        )}

                        {shiftLists.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic pl-1">
                            Inga checklistor för detta pass.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {shiftLists.map((list) => {
                              const listItems = (items as any[])
                                .filter((i) => i.shift_checklist_id === list.id)
                                .sort((a, b) => a.sort_order - b.sort_order);
                              const done = listItems.filter((i) => i.is_checked).length;
                              const total = listItems.length;
                              const pct = total > 0 ? (done / total) * 100 : 0;
                              const complete = total > 0 && done === total;
                              return (
                                <div key={list.id} className="border rounded-xl p-3 bg-background/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-foreground">{list.name}</h4>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      {done}/{total}
                                    </span>
                                  </div>
                                  <Progress
                                    value={pct}
                                    className={`h-1.5 mb-3 ${complete ? "[&>div]:bg-[hsl(150_45%_45%)]" : "[&>div]:bg-[hsl(183_30%_45%)]"}`}
                                  />
                                  {listItems.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">Inga punkter</p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {listItems.map((it) => (
                                        <li key={it.id} className="flex items-center gap-2.5 text-sm">
                                          {it.is_checked ? (
                                            <span className="h-5 w-5 rounded-full bg-[hsl(150_45%_45%)] flex items-center justify-center shrink-0">
                                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                            </span>
                                          ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                                          )}
                                          <span className={it.is_checked ? "text-muted-foreground line-through" : "text-foreground"}>
                                            {it.text}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  });
                })()}
              </div>

              <div className="mt-4">
                <Button variant="outline" className="w-full" onClick={() => setSelectedWorker(null)}>
                  Stäng
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <VersionTag className="text-center pt-2" />
    </div>
  );
};

export default AdminOverview;
