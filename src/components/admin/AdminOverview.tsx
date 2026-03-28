import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, AlertTriangle, Users, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek } from "date-fns";
import { sv } from "date-fns/locale";

interface AdminOverviewProps {
  onNavigate: (tab: string) => void;
}

const AdminOverview = ({ onNavigate }: AdminOverviewProps) => {
  const { data: teamCount = 0, isLoading: loadingTeam } = useQuery({
    queryKey: ["team-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("workers")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: activeClocks = 0, isLoading: loadingActive } = useQuery({
    queryKey: ["active-clocks"],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const { count, error } = await supabase
        .from("time_entries")
        .select("*", { count: "exact", head: true })
        .is("clock_out", null)
        .gte("clock_in", startOfDay.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: weeklyHours = 0, isLoading: loadingWeekly } = useQuery({
    queryKey: ["weekly-hours"],
    queryFn: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .gte("clock_in", weekStart.toISOString())
        .not("clock_out", "is", null);
      if (error) throw error;
      return (data || []).reduce((sum, e) => {
        return sum + (new Date(e.clock_out!).getTime() - new Date(e.clock_in!).getTime()) / 3600000;
      }, 0);
    },
    refetchInterval: 30000,
  });

  const { data: pendingCorrections = 0, isLoading: loadingCorrections } = useQuery({
    queryKey: ["pending-corrections-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("time_correction_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: recentEntries = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["recent-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("clock_in", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const cards = [
    {
      label: "Teammedlemmar",
      value: teamCount,
      icon: Users,
      loading: loadingTeam,
      tab: "team",
    },
    {
      label: "Instämplade nu",
      value: activeClocks,
      icon: Clock,
      loading: loadingActive,
      tab: "tidslogg",
      highlight: activeClocks > 0,
    },
    {
      label: "Timmar denna vecka",
      value: weeklyHours.toFixed(1) + " h",
      icon: Activity,
      loading: loadingWeekly,
      tab: "tidslogg",
    },
    {
      label: "Väntande rättelser",
      value: pendingCorrections,
      icon: AlertTriangle,
      loading: loadingCorrections,
      tab: "rattelser",
      highlight: pendingCorrections > 0,
    },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-foreground">Översikt</h2>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.tab)}
            className="border border-border bg-card rounded-2xl p-5 text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <card.icon className={`h-5 w-5 mb-3 ${card.highlight ? "text-primary" : "text-muted-foreground"}`} />
            {card.loading ? (
              <Skeleton className="h-7 w-14 mb-1" />
            ) : (
              <p className={`text-2xl font-semibold tabular-nums ${card.highlight ? "text-primary" : "text-foreground"}`}>
                {card.value}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Recent activity */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">Senaste aktivitet</h3>
        {loadingRecent ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : recentEntries.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Inga stämplingar ännu</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {recentEntries.map((entry) => {
              const hours = entry.clock_in && entry.clock_out
                ? ((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000)
                : null;
              const isActive = entry.clock_in && !entry.clock_out;

              return (
                <div key={entry.id} className="px-4 py-3 flex items-center justify-between bg-card">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{entry.worker_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {entry.clock_in ? format(new Date(entry.clock_in), "d MMM HH:mm", { locale: sv }) : "–"}
                      {" – "}
                      {entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {isActive ? (
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        <span className="text-xs text-primary font-medium">Aktiv</span>
                      </div>
                    ) : hours !== null ? (
                      <span className="text-sm font-semibold text-foreground tabular-nums">{hours.toFixed(1)} h</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOverview;
