import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WashingMachine, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";

const ANNOUNCEMENT_ID = "laundry-help-v2";
const storageKey = (userId: string) =>
  `announcement:${ANNOUNCEMENT_ID}:acked:${userId}`;
const LAUNDRY_PATH = "/help/laundry";

export const ackLaundryAnnouncement = (userId: string) => {
  try {
    localStorage.setItem(storageKey(userId), new Date().toISOString());
  } catch {
    // ignore
  }
};

export default function LaundryAnnouncementModal() {
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
    location.pathname === LAUNDRY_PATH;

  useEffect(() => {
    if (user && location.pathname === LAUNDRY_PATH) {
      ackLaundryAnnouncement(user.id);
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
    if (user) ackLaundryAnnouncement(user.id);
    setOpen(false);
    navigate(LAUNDRY_PATH);
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
            <WashingMachine className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">
            Nytt: Tvättmaskin &amp; torktumlare – guide
          </DialogTitle>
          <DialogDescription className="text-center">
            Nu finns en steg-för-steg-guide för tvättmaskinen och torktumlaren
            i hjälpavsnittet. Sortering, dosering och Cotton på 40°C med
            1400 varv (25 min) — med bilder från maskinen så du ser exakt vad
            du ska trycka på.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleOpen} className="w-full" size="lg">
            <ExternalLink className="h-4 w-4 mr-2" />
            Öppna tvättguiden
          </Button>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Rutan försvinner när du öppnat guiden.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
