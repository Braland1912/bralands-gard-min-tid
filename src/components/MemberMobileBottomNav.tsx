import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, Calendar, Clock, AlertTriangle, Menu, Moon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useWorker } from "@/hooks/useWorker";

type ActiveKey = "hem" | "schema" | "tidrapport" | "rattelser" | "mer";

interface Props {
  active: ActiveKey;
}

const tabs: { id: ActiveKey; label: string; icon: any }[] = [
  { id: "hem", label: "Hem", icon: Home },
  { id: "schema", label: "Schema", icon: Calendar },
  { id: "tidrapport", label: "Tidrapport", icon: Clock },
  { id: "rattelser", label: "Rättelser", icon: AlertTriangle },
];

const moreTabs = [
  { id: "kvallsrundan", label: "Kvällsrundan", icon: Moon, path: "/evening-round" },
];

const MemberMobileBottomNav = ({ active }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: worker } = useWorker(user?.id);
  const [moreOpen, setMoreOpen] = useState(false);

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
    if (id === "hem") {
      navigate("/");
      return;
    }
    if (id === "schema") {
      navigate("/my-schedule");
      return;
    }
    if (id === "tidrapport") {
      navigate("/my-time", { state: { tab: "tidrapport" } });
      return;
    }
    if (id === "rattelser") {
      navigate("/my-time", { state: { tab: "rattelser" } });
      return;
    }
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
            {tab.id === "rattelser" && pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold flex items-center justify-center leading-none">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">{tab.label}</span>
        </button>
      ))}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl min-w-[52px] transition-colors ${
              active === "mer" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu className="h-4 w-4" />
            <span className="text-[10px] font-medium">Mer</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Mer</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {moreTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(tab.path);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
};

export default MemberMobileBottomNav;
