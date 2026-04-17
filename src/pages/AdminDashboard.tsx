import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Clock, AlertTriangle, Users, Link2, LogOut, DollarSign, RefreshCw, Calendar, ListChecks, Menu } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminTimeLog from "@/components/admin/AdminTimeLog";
import TimeCorrectionRequests from "@/components/TimeCorrectionRequests";
import AdminTeam from "@/components/admin/AdminTeam";
import InvitationManager from "@/components/InvitationManager";
import SalaryReport from "@/components/SalaryReport";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import logo from "@/assets/logo-braland.svg";

const tabs = [
  { id: "oversikt", label: "Översikt", icon: LayoutDashboard },
  { id: "tidslogg", label: "Tidslogg", icon: Clock },
  { id: "rattelser", label: "Rättelser", icon: AlertTriangle },
  { id: "team", label: "Team", icon: Users },
  { id: "bjudin", label: "Bjud in", icon: Link2 },
  { id: "lon", label: "Löner", icon: DollarSign },
  { id: "schema", label: "Schema", icon: Calendar },
  { id: "checklistor", label: "Checklistor", icon: ListChecks },
];

const mobileBottomTabs = [
  { id: "oversikt", label: "Översikt", icon: LayoutDashboard },
  { id: "schema", label: "Schema", icon: Calendar },
  { id: "tidslogg", label: "Tidslogg", icon: Clock },
  { id: "rattelser", label: "Rättelser", icon: AlertTriangle },
];

const mobileMoreTabs = [
  { id: "team", label: "Team", icon: Users },
  { id: "checklistor", label: "Checklistor", icon: ListChecks },
  { id: "bjudin", label: "Bjud in", icon: Link2 },
  { id: "lon", label: "Löner", icon: DollarSign },
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("oversikt");
  const [refreshing, setRefreshing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-corrections-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("time_correction_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const handleTabChange = (tabId: string) => {
    if (tabId === "schema") {
      navigate("/admin/schedule");
      return;
    }
    if (tabId === "checklistor") {
      navigate("/admin/checklists");
      return;
    }
    setActiveTab(tabId);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleLogout = async () => {
    queryClient.clear();
    await signOut();
    navigate("/", { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "oversikt":
        return <AdminOverview onNavigate={setActiveTab} />;
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
        return <AdminOverview onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card min-h-screen">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <button onClick={() => setActiveTab("oversikt")} className="focus:outline-none">
            <img src={logo} alt="Brålands Gård" className="h-8 w-auto object-contain cursor-pointer" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground">Brålands Gård</h1>
            <p className="text-xs text-muted-foreground">Administration</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.id === "rattelser" && pendingCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <ChangePasswordDialog />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
          >
            <LogOut className="h-4 w-4" />
            Logga ut
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <button onClick={() => setActiveTab("oversikt")} className="flex items-center gap-2 focus:outline-none">
            <img src={logo} alt="Brålands Gård" className="h-7 w-auto object-contain cursor-pointer" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl text-muted-foreground hover:bg-accent transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
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
        <main className="flex-1 p-5 pb-24 md:pb-6 max-w-4xl mx-auto w-full">
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
