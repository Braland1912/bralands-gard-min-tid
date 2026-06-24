import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, LogOut, Clock, CalendarDays, Home, Moon, LifeBuoy, Building2, ListChecks } from "lucide-react";
import logo from "@/assets/logo-braland.svg";
import VersionTag from "@/components/VersionTag";

const AppHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: worker } = useWorker(user?.id);
  const { isAdmin } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Hide header on admin dashboard (has its own header), login pages, and registration
  const hiddenPaths = ["/admin/dashboard", "/admin", "/login"];
  const isHidden = hiddenPaths.includes(location.pathname) || location.pathname.startsWith("/invite/");
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (isHidden) return null;

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/", { replace: true });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Don't show header for admins (they use their own dashboard header)
  // Don't show user info for unauthenticated users
  const showUserInfo = !!user && !!worker && !isAdmin;

  const baseNav = [
    { label: "Hem", icon: Home, path: "/" },
    { label: "Uppgifter", icon: ListChecks, path: "/today-tasks" },
    { label: "Schema", icon: CalendarDays, path: "/my-schedule" },
    { label: "Kvällsrundan", icon: Moon, path: "/evening-round" },
    { label: "Tidrapport", icon: Clock, path: "/my-time" },
  ];
  const navItems = [
    ...baseNav,
    ...(worker?.can_see_lodge ? [{ label: "Uthyrning", icon: Building2, path: "/lodge" }] : []),
    { label: "Hjälp", icon: LifeBuoy, path: "/help" },
  ];

  return (
    <header className="md:hidden w-full border-b border-border bg-card px-5 py-3 flex items-center justify-between">
      <button
        onClick={() => navigate("/")}
        className="flex items-center focus:outline-none"
        aria-label="Gå till startsidan"
      >
        <img src={logo} alt="Brålands Gård" className="h-9 sm:h-10 w-auto" />
      </button>

      {showUserInfo && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            aria-label="Öppna meny"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden">
              {/* User block */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(worker.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{worker.name}</div>
                  <div className="text-xs text-muted-foreground">Medarbetare</div>
                </div>
              </div>

              {/* Nav items */}
              <div className="py-1">
                {navItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        setMenuOpen(false);
                        navigate(item.path);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Divider + logout */}
              <div className="border-t border-border py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logga ut
                </button>
              </div>

              {/* Version */}
              <div className="border-t border-border px-4 py-2">
                <VersionTag />
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default AppHeader;
