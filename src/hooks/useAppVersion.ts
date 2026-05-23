import { useEffect, useState } from "react";
import { APP_VERSION } from "@/lib/app-version";

interface VersionState {
  current: string;
  latest: string | null;
  notes: string | null;
  hasUpdate: boolean;
}

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 min

/**
 * Pollar /version.json och jämför mot inbakad APP_VERSION.
 * Sätter hasUpdate=true så snart servern har en nyare version.
 */
export function useAppVersion(): VersionState {
  const [latest, setLatest] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string; notes?: string };
        if (cancelled || !data.version) return;
        setLatest(data.version);
        setNotes(typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null);
      } catch {
        // offline / dev – ignorera tyst
      }
    };

    check();
    const id = window.setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return {
    current: APP_VERSION,
    latest,
    notes,
    hasUpdate: !!latest && latest !== APP_VERSION && APP_VERSION !== "dev",
  };
}
