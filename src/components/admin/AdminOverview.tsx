import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users, AlertTriangle, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminOverviewProps {
  onNavigate: (tab: string) => void;
}

const AdminOverview = ({ onNavigate }: AdminOverviewProps) => {
  const { data: activeClocks = 0, isLoading: loadingActive } = useQuery({
    queryKey: ["active-clocks"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("time_entries")
        .select("*", { count: "exact", head: true })
        .is("clock_out", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: todayHours = 0, isLoading: loadingHours } = useQuery({
    queryKey: ["today-hours"],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .gte("clock_in", startOfDay.toISOString())
        .not("clock_out", "is", null);
      if (error) throw error;
      return (data || []).reduce((sum, e) => {
        const hours = (new Date(e.clock_out!).getTime() - new Date(e.clock_in!).getTime()) / 3600000;
        return sum + hours;
      }, 0);
    },
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

  const { data: pendingMembers = 0, isLoading: loadingMembers } = useQuery({
    queryKey: ["pending-members-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pending_members")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const cards = [
    {
      label: "Instämplade nu",
      value: activeClocks,
      icon: Clock,
      loading: loadingActive,
      tab: "tidslogg",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Timmar idag",
      value: todayHours.toFixed(1) + " h",
      icon: Clock,
      loading: loadingHours,
      tab: "tidslogg",
      color: "text-accent-foreground",
      bg: "bg-accent/20",
    },
    {
      label: "Väntande rättelser",
      value: pendingCorrections,
      icon: AlertTriangle,
      loading: loadingCorrections,
      tab: "rattelser",
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Väntande ansökningar",
      value: pendingMembers,
      icon: UserCheck,
      loading: loadingMembers,
      tab: "team",
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Översikt</h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.tab)}
            className={`${card.bg} rounded-xl p-4 text-left transition-transform active:scale-95 hover:shadow-md`}
          >
            <card.icon className={`h-6 w-6 ${card.color} mb-2`} />
            {card.loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            )}
            <p className="text-sm text-muted-foreground">{card.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
