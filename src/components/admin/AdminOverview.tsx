import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Users, CalendarDays, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, startOfWeek, endOfWeek, addDays, formatDistanceToNowStrict } from "date-fns";
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
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const weekByUser = new Map<string, Set<number>>();
  (weekShifts as any[]).forEach((s) => {
    if (s.shift_type === "off") return;
    const dayIdx = weekDays.findIndex((d) => format(d, "yyyy-MM-dd") === s.date);
    if (dayIdx === -1) return;
    if (!weekByUser.has(s.user_id)) weekByUser.set(s.user_id, new Set());
    weekByUser.get(s.user_id)!.add(dayIdx);
  });
  const weekRows = Array.from(weekByUser.entries())
    .map(([uid, daySet]) => ({
      worker: workerByUserId.get(uid),
      days: Array.from(daySet).sort((a, b) => a - b),
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

      {/* Section: Currently clocked in */}
      <section className="border border-border bg-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
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
          <ul className="divide-y divide-border">
            {(activeEntries as any[]).map((entry) => {
              const since = entry.clock_in ? new Date(entry.clock_in) : null;
              const hoursSince = since ? (Date.now() - since.getTime()) / 3600000 : 0;
              const warning = hoursSince > 5;
              return (
                <li key={entry.id} className="py-2.5 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
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
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section: Working today */}
      <section className="border border-border bg-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
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
          <ul className="divide-y divide-border">
            {todayWorkers.map((w: any) => (
              <li key={w.id} className="py-2.5 flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(w.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-foreground truncate flex-1">{w.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section: Working this week */}
      <section className="border border-border bg-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Jobbar denna vecka</h3>
          </div>
        </div>

        {loadingWeek || loadingWorkers ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : weekRows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Ingen är schemalagd denna vecka.</p>
        ) : (
          <ul className="divide-y divide-border">
            {weekRows.map((row) => (
              <li key={row.worker.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground truncate">
                  {getShortName(row.worker.name)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.days.map((d) => DAY_NAMES[d]).join(", ")}
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
