import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogIn, ListChecks, Calendar, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useWorker } from "@/hooks/useWorker";

type ActiveKey = "hem" | "dagens-uppgifter" | "schema" | "tidrapport" | "kvallsrundan";

interface Props {
  active: ActiveKey;
}

const tabs: { id: ActiveKey; label: string; icon: any }[] = [
  { id: "hem", label: "Stämpla", icon: LogIn },
  { id: "dagens-uppgifter", label: "Uppgifter", icon: ListChecks },
  { id: "schema", label: "Schema", icon: Calendar },
  { id: "kvallsrundan", label: "Kvällen", icon: Moon },
];

const MemberMobileBottomNav = ({ active }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: worker } = useWorker(user?.id);

  // Visa pending-badge på Tidrapport (där Rättelser-fliken bor)
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["my-pending-corrections", worker?.id],
    queryFn: async () => {
      if (!worker?.id) return 0;
      const { count, error } = await supabase
        .from("time_correction_requests")
        .select("id", { count: "exact", head: true })
        .eq("worker_id", worker.id)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!worker?.id,
    refetchInterval: 15000,
  });

  if (!user || adminLoading || isAdmin) return null;

  const handleTabClick = (id: ActiveKey) => {
    if (id === "hem") return navigate("/");
    if (id === "dagens-uppgifter") return navigate("/today-tasks");
    if (id === "schema") return navigate("/my-schedule");
    if (id === "tidrapport") return navigate("/my-time", { state: { tab: "tidrapport" } });
    if (id === "kvallsrundan") return navigate("/evening-round");
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex justify-around py-2 safe-area-bottom">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl min-w-[52px] transition-colors ${
            active === tab.id ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <div className="relative">
            <tab.icon className="h-4 w-4" />
            {tab.id === "tidrapport" && pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold flex items-center justify-center leading-none">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default MemberMobileBottomNav;
