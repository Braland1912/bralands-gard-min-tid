import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo-braland.svg";

const AppHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: worker } = useWorker(user?.id);
  const { isAdmin } = useAdmin();

  // Hide header on admin dashboard (has its own header), login pages, and registration
  const hiddenPaths = ["/admin/dashboard", "/admin", "/login"];
  const isHidden = hiddenPaths.includes(location.pathname) || location.pathname.startsWith("/invite/");
  if (isHidden) return null;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
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

  return (
    <header className="w-full border-b border-border bg-card px-5 py-3 flex items-center justify-between">
      <button
        onClick={() => navigate("/")}
        className="flex items-center focus:outline-none"
        aria-label="Gå till startsidan"
      >
        <img src={logo} alt="Brålands Gård" className="h-9 sm:h-10 w-auto" />
      </button>

      {showUserInfo && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(worker.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {worker.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground h-8 px-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Logga ut</span>
          </Button>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
