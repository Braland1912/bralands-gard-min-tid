import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Clock, AlertTriangle, Users, Link2, LogOut, DollarSign, RefreshCw, Calendar, ListChecks } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminTimeLog from "@/components/admin/AdminTimeLog";
import TimeCorrectionRequests from "@/components/TimeCorrectionRequests";
import AdminTeam from "@/components/admin/AdminTeam";
import InvitationManager from "@/components/InvitationManager";
import SalaryReport from "@/components/SalaryReport";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
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

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("oversikt");
  const [refreshing, setRefreshing] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleTabChange = (tabId: string) => {
    if (tabId === "schema") {
      navigate("/admin/schedule");
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
              {tab.label}
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
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl min-w-[52px] transition-colors ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default AdminDashboard;
