import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";

const ANNOUNCEMENT_ID = "cleaning-help-v1";
const storageKey = (userId: string) => `announcement:${ANNOUNCEMENT_ID}:acked:${userId}`;
const CLEANING_PATH = "/help/cleaning";

export const ackCleaningAnnouncement = (userId: string) => {
  try {
    localStorage.setItem(storageKey(userId), new Date().toISOString());
  } catch {
    // ignore
  }
};

export default function CleaningAnnouncementModal() {
  const { user } = useAuth();
  const { data: worker } = useWorker(user?.id);
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const hiddenPaths = ["/login", "/admin", "/admin/dashboard", "/confirmation"];
  const isHidden =
    hiddenPaths.includes(location.pathname) ||
    location.pathname.startsWith("/invite/") ||
    location.pathname === CLEANING_PATH;

  useEffect(() => {
    if (user && location.pathname === CLEANING_PATH) {
      ackCleaningAnnouncement(user.id);
      setOpen(false);
    }
  }, [user, location.pathname]);

  useEffect(() => {
    if (!user || !worker || isAdmin || isHidden) {
      setOpen(false);
      return;
    }
    try {
      const acked = localStorage.getItem(storageKey(user.id));
      setOpen(!acked);
    } catch {
      setOpen(true);
    }
  }, [user, worker, isAdmin, isHidden, location.pathname]);

  if (!open) return null;

  const handleOpen = () => {
    if (user) ackCleaningAnnouncement(user.id);
    setOpen(false);
    navigate(CLEANING_PATH);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* blocking */ }}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Nytt: Städrutiner</DialogTitle>
          <DialogDescription className="text-center">
            Nu finns våra städrutiner i hjälpavsnittet. Läs igenom dem så vi alla städar likadant –
            grundordning, metall & kalk, trasor och grovstädning.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleOpen} className="w-full" size="lg">
            <ExternalLink className="h-4 w-4 mr-2" />
            Öppna städrutinerna
          </Button>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Rutan försvinner när du öppnat städrutinerna.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
