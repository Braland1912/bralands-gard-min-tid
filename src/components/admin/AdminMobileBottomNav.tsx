import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Calendar, Clock, AlertTriangle, Menu, Users, ListChecks, Link2, DollarSign, LogOut, Moon, GitBranch, Flame } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

type ActiveKey = "oversikt" | "schema" | "tidslogg" | "rattelser" | "kvallsrundan" | "mer";

interface Props {
  active: ActiveKey;
}

const bottomTabs: { id: ActiveKey; label: string; icon: any }[] = [
  { id: "oversikt", label: "Översikt", icon: LayoutDashboard },
  { id: "schema", label: "Schema", icon: Calendar },
  { id: "tidslogg", label: "Tidslogg", icon: Clock },
  { id: "rattelser", label: "Rättelser", icon: AlertTriangle },
  { id: "kvallsrundan", label: "Kvällsrundan", icon: Moon },
];

const moreTabs = [
  { id: "team", label: "Team", icon: Users },
  { id: "checklistor", label: "Checklistor", icon: ListChecks },
  { id: "bjudin", label: "Bjud in", icon: Link2 },
  { id: "lon", label: "Löner", icon: DollarSign },
  { id: "versioner", label: "Versioner", icon: GitBranch },
  { id: "emergency", label: "Brand & nödläge", icon: Flame },
];

const AdminMobileBottomNav = ({ active }: Props) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: pendingCounts = { normal: 0, early: 0 } } = useQuery({
    queryKey: ["pending-corrections-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_correction_requests")
        .select("reason")
        .eq("status", "pending");
      if (error) throw error;
      const EARLY_PREFIX = "Tidig utstämpling med obockade punkter";
      let early = 0;
      let normal = 0;
      (data ?? []).forEach((r: any) => {
        if (typeof r.reason === "string" && r.reason.startsWith(EARLY_PREFIX)) early++;
        else normal++;
      });
      return { normal, early };
    },
    refetchInterval: 15000,
  });

  const pendingCount = pendingCounts.normal;
  const earlyCount = pendingCounts.early;

  const goToDashboard = (tab: string) => {
    navigate("/admin/dashboard", { state: { tab } });
  };

  const handleTabClick = (id: ActiveKey) => {
    if (id === "schema") {
      navigate("/admin/schedule");
      return;
    }
    if (id === "oversikt") {
      goToDashboard("oversikt");
      return;
    }
    if (id === "tidslogg") {
      goToDashboard("tidslogg");
      return;
    }
    if (id === "rattelser") {
      goToDashboard("rattelser");
      return;
    }
    if (id === "kvallsrundan") {
      navigate("/evening-round");
      return;
    }
  };

  const handleMoreClick = (id: string) => {
    setMoreOpen(false);
    if (id === "checklistor") {
      navigate("/admin/checklists");
      return;
    }
    if (id === "kvallsrundan") {
      navigate("/evening-round");
      return;
    }
    goToDashboard(id);
  };

  const handleLogout = async () => {
    queryClient.clear();
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex justify-around py-2 safe-area-bottom">
      {bottomTabs.map((tab) => (
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
            {tab.id === "rattelser" && earlyCount > 0 && (
              <span
                className={`absolute min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none ${
                  pendingCount > 0 ? "-top-1.5 -left-2.5" : "-top-1.5 -right-2"
                }`}
                title="Nya tidiga utstämplingar"
              >
                {earlyCount > 99 ? "99+" : earlyCount}
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
                onClick={() => handleMoreClick(tab.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
            <Separator className="my-2" />
            <div className="flex items-center gap-2 px-3 py-2">
              <ChangePasswordDialog />
              <span className="text-sm text-muted-foreground">Byt lösenord</span>
            </div>
            <button
              onClick={() => {
                setMoreOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logga ut
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
};

export default AdminMobileBottomNav;
