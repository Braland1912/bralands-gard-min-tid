import { APP_VERSION } from "@/lib/app-version";
import { useAppVersion } from "@/hooks/useAppVersion";

/**
 * Diskret versionschip – visas på inlogg, i admin-översikten och i medlemsmenyn.
 * Visar "senaste" när klienten kör samma version som servern.
 */
export default function VersionTag({ className = "" }: { className?: string }) {
  const { latest, hasUpdate } = useAppVersion();
  if (!APP_VERSION) return null;

  const isLatest = !!latest && !hasUpdate && APP_VERSION !== "dev";

  return (
    <p
      className={`text-[10px] uppercase tracking-wide text-muted-foreground/70 tabular-nums ${className}`}
    >
      v{APP_VERSION}
      {isLatest && (
        <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">
          · senaste
        </span>
      )}
    </p>
  );
}
