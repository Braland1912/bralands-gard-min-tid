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

  // Pending corrections (kept)
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

  // Currently clocked in
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

  // All workers (for scheduled lists)
  const { data: workers = [], isLoading: loadingWorkers } = useQuery({
    queryKey: ["workers-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Schedules for today
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

  // Schedules for this week
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

  // Map workers by user_id for quick lookup
  const workerByUserId = new Map<string, any>();
  (workers as any[]).forEach((w) => {
    if (w.user_id) workerByUserId.set(w.user_id, w);
  });

  // Today's working workers (deduped by user_id, exclude "off")
  const todayWorkingUserIds = Array.from(
    new Set(
      (todayShifts as any[])
        .filter((s) => s.shift_type !== "off")
        .map((s) => s.user_id),
    ),
  );
  const todayWorkers = todayWorkingUserIds
    .map((uid) => workerByUserId.get(uid))
    .filter(Boolean);

  // Week schedule grouped per user_id → set of day indices
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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Översikt</h2>

      {/* Pending corrections summary card (compact, clickable) */}
      <button
        onClick={() => onNavigate("rattelser")}
        className={`w-full border rounded-2xl p-4 text-left flex items-center justify-between transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] ${
          pendingCorrections.length > 0
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              pendingCorrections.length > 0 ? "bg-primary/10" : "bg-muted"
            }`}
          >
            <AlertTriangle
              className={`h-5 w-5 ${
                pendingCorrections.length > 0 ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Väntande rättelser</p>
            <p
              className={`text-lg font-semibold ${
                pendingCorrections.length > 0 ? "text-primary" : "text-foreground"
              }`}
            >
              {loadingCorrections ? "…" : pendingCorrections.length}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Visa →</span>
      </button>

      {/* Section 1: Currently clocked in */}
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

      {/* Section 2: Working today */}
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

      {/* Section 3: Working this week */}
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

      {/* Section 4: Pending corrections list */}
      <section className="border border-border bg-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${
                pendingCorrections.length > 0 ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <h3 className="text-base font-semibold text-foreground">Väntande rättelser</h3>
          </div>
          <button
            onClick={() => onNavigate("rattelser")}
            className="text-xs text-primary font-medium hover:underline"
          >
            Hantera →
          </button>
        </div>

        {loadingCorrections ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : pendingCorrections.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Inga väntande rättelser.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(pendingCorrections as any[]).map((c) => (
              <li key={c.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{c.worker_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(c.date), "d MMM yyyy", { locale: sv })}
                    {c.reason ? ` · ${c.reason}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AdminOverview;
