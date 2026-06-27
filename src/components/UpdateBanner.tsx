import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppVersion } from "@/hooks/useAppVersion";
import { forceAppUpdate } from "@/lib/app-version";

/**
 * Tvingande uppdaterings-banner. Går inte att stänga.
 * Auto-triggar nedladdning av ny version efter kort fördröjning.
 */
export default function UpdateBanner() {
  const { hasUpdate, latest, notes } = useAppVersion();
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    await forceAppUpdate();
  };

  useEffect(() => {
    if (!hasUpdate) return;
    const t = setTimeout(() => {
      handleUpdate();
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUpdate]);

  if (!hasUpdate) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full border-b border-primary/20 bg-primary text-primary-foreground"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3 px-4 py-2.5">
        <RefreshCw className={`h-4 w-4 shrink-0 mt-0.5 ${updating ? "animate-spin" : ""}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">Ny version krävs</p>
          {notes ? (
            <p className="text-[12px] opacity-90 leading-snug mt-0.5">
              <span className="font-medium">Nytt:</span> {notes}
            </p>
          ) : (
            latest && (
              <p className="text-[11px] opacity-80 leading-tight">
                Uppdaterar till v{latest}…
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
      </div>
    </div>
  );
}
