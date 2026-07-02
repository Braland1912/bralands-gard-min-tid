import { useAppVersion } from "@/hooks/useAppVersion";
import { APP_VERSION } from "@/lib/app-version";

/**
 * Kompakt versionsvisning för headern.
 * Visar aktuell version + liten prick när nyare version finns.
 */
export default function HeaderVersion({ className = "" }: { className?: string }) {
  const { hasUpdate, latest } = useAppVersion();

  if (!APP_VERSION) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/70 tabular-nums ${className}`}
      title={
        hasUpdate && latest
          ? `Ny version tillgänglig: v${latest}`
          : `Version ${APP_VERSION}`
      }
    >
      v{APP_VERSION}
      {hasUpdate && (
        <span
          aria-label="Ny version tillgänglig"
          className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
        />
      )}
    </span>
  );
}
