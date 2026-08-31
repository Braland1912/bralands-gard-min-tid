import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Calendar,
  Clock,
  AlertTriangle,
  LayoutDashboard,
  Users,
  ListChecks,
  Link2,
  DollarSign,
  LogOut,
  Moon,
  LifeBuoy,
  GitBranch,
  Tags,
  Building2,
  LogIn,
  Flame,
  Settings,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useWorker } from "@/hooks/useWorker";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import logo from "@/assets/logo-braland.svg";

type NavItem = {
  id: string;
  label: string;
  icon: any;
  /** Either an exact navigation path, or a dashboard tab id (for admins). */
  path?: string;
  dashboardTab?: string;
  /** Active matcher: route path or dashboard tab id */
  matchPath?: string;
  matchTab?: string;
};

const memberItems: NavItem[] = [
  { id: "hem", label: "Stämpla in/ut", icon: LogIn, path: "/", matchPath: "/" },
  { id: "dagens-uppgifter", label: "Dagens uppgifter", icon: ListChecks, path: "/today-tasks", matchPath: "/today-tasks" },
  { id: "schema", label: "Schema", icon: Calendar, path: "/my-schedule", matchPath: "/my-schedule" },
  { id: "tidrapport", label: "Tidrapport", icon: Clock, path: "/my-time", matchPath: "/my-time" },
  { id: "kvallsrundan", label: "Kvällsrundan", icon: Moon, path: "/evening-round", matchPath: "/evening-round" },
  { id: "checklistor", label: "Checklistor", icon: ListChecks, path: "/admin/checklists", matchPath: "/admin/checklists" },
  { id: "hjalp", label: "Hjälp", icon: LifeBuoy, path: "/help", matchPath: "/help" },
  { id: "emergency", label: "Brand & nödläge", icon: Flame, path: "/emergency", matchPath: "/emergency" },
];

const adminItems: NavItem[] = [
  { id: "oversikt", label: "Översikt", icon: LayoutDashboard, dashboardTab: "oversikt", matchTab: "oversikt" },
  { id: "schema", label: "Schema", icon: Calendar, path: "/admin/schedule", matchPath: "/admin/schedule" },
  { id: "tidslogg", label: "Tidslogg", icon: Clock, dashboardTab: "tidslogg", matchTab: "tidslogg" },
  { id: "rattelser", label: "Rättelser", icon: AlertTriangle, dashboardTab: "rattelser", matchTab: "rattelser" },
  { id: "team", label: "Team", icon: Users, dashboardTab: "team", matchTab: "team" },
  { id: "uppgifter", label: "Uppgifter", icon: Tags, dashboardTab: "uppgifter", matchTab: "uppgifter" },
  { id: "checklistor", label: "Checklistor", icon: ListChecks, path: "/admin/checklists", matchPath: "/admin/checklists" },
  { id: "kvallsrundan", label: "Kvällsrundan", icon: Moon, path: "/evening-round", matchPath: "/evening-round" },
  { id: "bjudin", label: "Bjud in", icon: Link2, dashboardTab: "bjudin", matchTab: "bjudin" },
  { id: "lon", label: "Löner", icon: DollarSign, dashboardTab: "lon", matchTab: "lon" },
  { id: "installningar", label: "Inställningar", icon: Settings, dashboardTab: "installningar", matchTab: "installningar" },
  { id: "versioner", label: "Versioner", icon: GitBranch, dashboardTab: "versioner", matchTab: "versioner" },
  { id: "statistik", label: "Statistik", icon: BarChart3, path: "/statistik", matchPath: "/statistik" },
  { id: "lodge", label: "Uthyrning", icon: Building2, path: "/lodge", matchPath: "/lodge" },
  { id: "hjalp", label: "Hjälp", icon: LifeBuoy, path: "/help", matchPath: "/help" },
  { id: "emergency", label: "Brand & nödläge", icon: Flame, path: "/emergency", matchPath: "/emergency" },
];

const DesktopSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: worker } = useWorker(user?.id);

  // Member pending corrections
  const { data: memberPending = 0 } = useQuery({
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
    enabled: !!worker?.id && !isAdmin,
    refetchInterval: 15000,
  });

  // Admin pending counts
  const { data: adminPending = { normal: 0, early: 0 } } = useQuery({
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
    enabled: !!isAdmin,
    refetchInterval: 15000,
  });

  if (!user || adminLoading) return null;

  const canManageChecklists = isAdmin || (worker as any)?.can_manage_checklists === true;
  const baseItems = (isAdmin ? adminItems : memberItems).filter(
    (i) => (i.id !== "checklistor" || canManageChecklists) && i.id !== "lodge",
  );
  const showLodge = isAdmin || worker?.can_see_lodge === true;
  const lodgeItem: NavItem = { id: "lodge", label: "Uthyrning", icon: Building2, path: "/lodge", matchPath: "/lodge" };
  const items = showLodge
    ? (() => {
        // Lägg in före "Hjälp" om det finns, annars i slutet
        const idx = baseItems.findIndex((i) => i.id === "hjalp");
        if (idx === -1) return [...baseItems, lodgeItem];
        return [...baseItems.slice(0, idx), lodgeItem, ...baseItems.slice(idx)];
      })()
    : baseItems;

  // Determine active item
  const currentTab = (location.state as any)?.tab as string | undefined;
  const isActive = (item: NavItem): boolean => {
    if (isAdmin) {
      if (item.matchPath && location.pathname === item.matchPath) return true;
      if (item.matchTab && location.pathname === "/admin/dashboard") {
        return (currentTab ?? "oversikt") === item.matchTab;
      }
      return false;
    }
    // Member
    if (item.id === "hem") return location.pathname === "/";
    if (item.id === "dagens-uppgifter") return location.pathname === "/today-tasks";
    if (item.id === "schema") return location.pathname === "/my-schedule";
    if (item.id === "tidrapport") return location.pathname === "/my-time";
    if (item.id === "kvallsrundan") return location.pathname === "/evening-round";
    if (item.id === "lodge") return location.pathname === "/lodge";
    if (item.id === "hjalp") return location.pathname.startsWith("/help") || location.pathname.startsWith("/evening-round/help");
    if (item.id === "emergency") return location.pathname === "/emergency";
    if (item.id === "statistik") return location.pathname === "/statistik";
    return false;
  };

  const handleClick = (item: NavItem) => {
    if (item.path && !item.dashboardTab) {
      if (!isAdmin && item.id === "tidrapport") {
        navigate("/my-time", { state: { tab: "tidrapport" } });
        return;
      }
      navigate(item.path);
      return;
    }
    if (item.dashboardTab) {
      navigate("/admin/dashboard", { state: { tab: item.dashboardTab } });
    }
  };

  const handleLogout = async () => {
    queryClient.clear();
    await signOut();
    navigate("/", { replace: true });
  };

  const renderBadge = (item: NavItem) => {
    // Admin behåller egen Rättelser-flik med badge
    if (isAdmin && item.id === "rattelser") {
      return (
        <div className="flex items-center gap-1">
          {adminPending.early > 0 && (
            <span
              className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none"
              title="Nya tidiga utstämplingar"
            >
              {adminPending.early > 99 ? "99+" : adminPending.early}
            </span>
          )}
          {adminPending.normal > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
              {adminPending.normal > 99 ? "99+" : adminPending.normal}
            </span>
          )}
        </div>
      );
    }
    // Medlemmar: badge på Tidrapport (Rättelser nås via flik där)
    if (!isAdmin && item.id === "tidrapport" && memberPending > 0) {
      return (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
          {memberPending > 99 ? "99+" : memberPending}
        </span>
      );
    }
    return null;
  };

  const handleNavKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const focusables = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-sidebar-nav-item]"),
    );
    if (focusables.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusables[(idx + 1) % focusables.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusables[(idx - 1 + focusables.length) % focusables.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      focusables[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      focusables[focusables.length - 1]?.focus();
    }
  };

  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 z-40 flex-col w-64 h-screen border-r border-border bg-card"
      aria-label="Huvudnavigering"
    >
      {/* Brand + user */}
      <div className="p-6 border-b border-border space-y-3">
        <button
          onClick={() => navigate(isAdmin ? "/admin/dashboard" : "/")}
          className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <img src={logo} alt="Brålands Gård" className="h-8 w-auto object-contain" />
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground leading-tight">Brålands Gård</div>
            <div className="text-[11px] text-muted-foreground">2026</div>
          </div>
        </button>
        {worker && (
          <div className="pt-1">
            <div className="text-sm font-medium text-foreground truncate">{worker.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {isAdmin ? "Administratör" : "Medarbetare"}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Sidnavigering">
        {items.map((item, idx) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              data-sidebar-nav-item
              onClick={() => handleClick(item)}
              onKeyDown={(e) => handleNavKeyDown(e, idx)}
              aria-current={active ? "page" : undefined}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                active
                  ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {renderBadge(item)}
            </button>
          );
        })}
      </nav>

      {/* Sticky bottom: change password + logout */}
      <div className="mt-auto p-3 border-t border-border space-y-1">
        <div className="flex items-center gap-2 px-1">
          <ChangePasswordDialog />
          <span className="text-sm text-muted-foreground">Byt lösenord</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <LogOut className="h-4 w-4" />
          Logga ut
        </button>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
