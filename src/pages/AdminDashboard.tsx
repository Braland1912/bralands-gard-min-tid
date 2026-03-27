import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Clock, AlertTriangle, Users, Link2, LogOut, DollarSign } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminTimeLog from "@/components/admin/AdminTimeLog";
import TimeCorrectionRequests from "@/components/TimeCorrectionRequests";
import AdminTeam from "@/components/admin/AdminTeam";
import InvitationManager from "@/components/InvitationManager";
import SalaryReport from "@/components/SalaryReport";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

const tabs = [
  { id: "oversikt", label: "Översikt", icon: LayoutDashboard },
  { id: "tidslogg", label: "Tidslogg", icon: Clock },
  { id: "rattelser", label: "Rättelser", icon: AlertTriangle },
  { id: "team", label: "Team", icon: Users },
  { id: "bjudin", label: "Bjud in", icon: Link2 },
  { id: "lon", label: "Löner", icon: DollarSign },
];

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("oversikt");
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
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
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-foreground">Brålands Gård</h1>
          <p className="text-xs text-muted-foreground">Administration</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <ChangePasswordDialog />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logga ut
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Brålands Gård</h1>
          </div>
          <div className="flex items-center gap-2">
            <ChangePasswordDialog />
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 pb-24 md:pb-6 max-w-4xl mx-auto w-full">
          {renderContent()}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex justify-around py-2 safe-area-bottom">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg min-w-[56px] transition-colors ${
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default AdminDashboard;
