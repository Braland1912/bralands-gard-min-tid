import { APP_VERSION } from "@/lib/app-version";

/**
 * Diskret versionschip – visas på inloggsidan och i admin-översikten.
 */
export default function VersionTag({ className = "" }: { className?: string }) {
  if (!APP_VERSION) return null;
  return (
    <p
      className={`text-[10px] uppercase tracking-wide text-muted-foreground/70 tabular-nums ${className}`}
    >
      v{APP_VERSION}
    </p>
  );
}
