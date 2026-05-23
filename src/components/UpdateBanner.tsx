import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppVersion } from "@/hooks/useAppVersion";
import { forceAppUpdate } from "@/lib/app-version";

/**
 * Visas högst upp när en nyare version finns på servern.
 * Användaren kan trycka "Uppdatera nu" eller stänga banner tillfälligt.
 */
export default function UpdateBanner() {
  const { hasUpdate, latest, notes } = useAppVersion();
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!hasUpdate || dismissed) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    await forceAppUpdate();
  };

  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full border-b border-primary/20 bg-primary text-primary-foreground"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3 px-4 py-2.5">
        <RefreshCw className={`h-4 w-4 shrink-0 mt-0.5 ${updating ? "animate-spin" : ""}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">Ny version finns</p>
          {notes ? (
            <p className="text-[12px] opacity-90 leading-snug mt-0.5">
              <span className="font-medium">Nytt:</span> {notes}
            </p>
          ) : (
            latest && (
              <p className="text-[11px] opacity-80 leading-tight">
                Uppdatera till v{latest} för senaste fixar
              </p>
            )
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 shrink-0"
          onClick={handleUpdate}
          disabled={updating}
        >
          {updating ? "Uppdaterar…" : "Uppdatera nu"}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Stäng"
          className="rounded p-1 hover:bg-primary-foreground/10 mt-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
