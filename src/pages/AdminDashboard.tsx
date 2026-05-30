import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Clock, AlertTriangle, Users, Link2, LogOut, DollarSign, Calendar, ListChecks, Menu, Moon, GitBranch } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminTimeLog from "@/components/admin/AdminTimeLog";
import TimeCorrectionRequests from "@/components/TimeCorrectionRequests";
import AdminTeam from "@/components/admin/AdminTeam";
import InvitationManager from "@/components/InvitationManager";
import SalaryReport from "@/components/SalaryReport";
import AdminVersions from "@/components/admin/AdminVersions";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import logo from "@/assets/logo-braland.svg";

// Sidebar items live in src/components/DesktopSidebar.tsx — keep mobile bottom-tabs here.


const mobileBottomTabs = [
  { id: "oversikt", label: "Översikt", icon: LayoutDashboard },
  { id: "schema", label: "Schema", icon: Calendar },
  { id: "tidslogg", label: "Tidslogg", icon: Clock },
  { id: "rattelser", label: "Rättelser", icon: AlertTriangle },
  { id: "kvallsrundan", label: "Kvällsrundan", icon: Moon },
];

const mobileMoreTabs = [
  { id: "team", label: "Team", icon: Users },
  { id: "checklistor", label: "Checklistor", icon: ListChecks },
  { id: "bjudin", label: "Bjud in", icon: Link2 },
  { id: "lon", label: "Löner", icon: DollarSign },
  { id: "versioner", label: "Versioner", icon: GitBranch },
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("oversikt");
  
  const [moreOpen, setMoreOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const stateTab = (location.state as any)?.tab;
    if (stateTab && typeof stateTab === "string") {
      setActiveTab(stateTab);
    }
  }, [location.state, location.key]);


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

  const handleTabChange = (tabId: string) => {
    if (tabId === "schema") {
      navigate("/admin/schedule");
      return;
    }
    if (tabId === "checklistor") {
      navigate("/admin/checklists");
      return;
    }
    if (tabId === "kvallsrundan") {
      navigate("/evening-round");
      return;
    }
    setActiveTab(tabId);
    // Sync URL state so the desktop sidebar reflects the change
    navigate("/admin/dashboard", { replace: true, state: { tab: tabId } });
  };

  const handleOverviewNavigate = (tabId: string) => handleTabChange(tabId);


  const handleLogout = async () => {
    queryClient.clear();
    await signOut();
    navigate("/", { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "oversikt":
        return <AdminOverview onNavigate={handleOverviewNavigate} />;
      case "tidslogg":
        return <AdminTimeLog />;
      case "rattelser":
        return <TimeCorrectionRequests />;
      case "team":
        return <AdminTeam />;
      case "bjudin":
        return <InvitationManager />;
      case "lon":
        return <SalaryReport />;
      default:
        return <AdminOverview onNavigate={handleOverviewNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <button onClick={() => setActiveTab("oversikt")} className="flex items-center gap-2 focus:outline-none">
            <img src={logo} alt="Brålands Gård" className="h-7 w-auto object-contain cursor-pointer" />
          </button>
          <div className="flex items-center gap-1">
            <ChangePasswordDialog />
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-5 pb-nav-safe md:pb-6 max-w-4xl mx-auto w-full">
          {renderContent()}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex justify-around py-2 safe-area-bottom">
          {mobileBottomTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl min-w-[52px] transition-colors ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground"
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
                  mobileMoreTabs.some((t) => t.id === activeTab)
                    ? "text-primary"
                    : "text-muted-foreground"
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
                {mobileMoreTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setMoreOpen(false);
                      handleTabChange(tab.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent"
                    }`}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
