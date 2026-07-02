import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, ExternalLink, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);

  // Hide on auth-less routes / registration
  const hiddenPaths = ["/login", "/admin", "/admin/dashboard", "/confirmation"];
  const isHidden =
    hiddenPaths.includes(location.pathname) ||
    location.pathname.startsWith("/invite/") ||
    location.pathname === CLEANING_PATH;

  // Auto-ack when they visit the cleaning help page
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

  const shareUrl = `${window.location.origin}${CLEANING_PATH}`;

  const handleOpen = () => {
    if (user) ackCleaningAnnouncement(user.id);
    setOpen(false);
    navigate(CLEANING_PATH);
  };

  const handleShare = async () => {
    const shareData = {
      title: "Städrutiner – Brålands Gård",
      text: "Nya städrutiner finns nu i hjälpavsnittet:",
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Länken är kopierad", description: shareUrl });
      }
      if (user) ackCleaningAnnouncement(user.id);
      setShared(true);
      setTimeout(() => setOpen(false), 600);
    } catch {
      // User cancelled share – don't ack
    }
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
          <Button onClick={handleShare} variant="outline" className="w-full" size="lg">
            {shared ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
            {shared ? "Delat" : "Vidarebefordra länk"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Rutan försvinner när du öppnat städrutinerna eller vidarebefordrat länken.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
