import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAppVersion } from "@/hooks/useAppVersion";
import { APP_VERSION } from "@/lib/app-version";

/**
 * Loggar tyst aktuell version + senaste sedda version till databasen så
 * admin kan se vilken version varje medarbetare kör och vem som fått notisen.
 *
 * - Skapar en rad i `app_releases` när vi ser en ny version (idempotent).
 * - Upsertar `worker_app_status` för inloggad medarbetare.
 */
export default function VersionTracker() {
  const { user } = useAuth();
  const { data: worker } = useWorker(user?.id);
  const { latest, notes, hasUpdate } = useAppVersion();
  const lastWrittenRef = useRef<string>("");

  // Logga release-noten när vi ser en ny version (oavsett inloggning räcker
  // ej – endast inloggade har skrivrättigheter, så vi väntar in user)
  useEffect(() => {
    if (!user || !latest) return;
    const key = `release:${latest}:${notes ?? ""}`;
    if (lastWrittenRef.current === key) return;
    lastWrittenRef.current = key;
    (async () => {
      // Försök skapa raden – krockar tyst om versionen redan finns.
      const { data: existing } = await supabase
        .from("app_releases")
        .select("version, notes")
        .eq("version", latest)
        .maybeSingle();
      if (!existing) {
        await supabase.from("app_releases").insert({
          version: latest,
          notes: notes ?? null,
          created_by: user.id,
        });
      } else if ((existing.notes ?? "") !== (notes ?? "") && notes) {
        // Uppdatera om noterna har förändrats sen första loggningen
        await supabase
          .from("app_releases")
          .update({ notes })
          .eq("version", latest);
      }
    })();
  }, [user, latest, notes]);

  // Heartbeat: skriv vilken version medarbetaren kör + sist sedd
  useEffect(() => {
    if (!user || !worker?.id) return;

    const write = async () => {
      await supabase.from("worker_app_status").upsert(
        {
          worker_id: worker.id,
          user_id: user.id,
          worker_name: worker.name,
          running_version: APP_VERSION,
          latest_seen_version: latest ?? APP_VERSION,
          last_seen_at: new Date().toISOString(),
          notified_at: hasUpdate ? new Date().toISOString() : null,
        },
        { onConflict: "worker_id" },
      );
    };

    write();
    const id = window.setInterval(write, 5 * 60 * 1000);
    const onFocus = () => write();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, worker?.id, worker?.name, latest, hasUpdate]);

  return null;
}
