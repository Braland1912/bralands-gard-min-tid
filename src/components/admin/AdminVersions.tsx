import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatLocalDateTime } from "@/lib/date-format";
import { APP_VERSION } from "@/lib/app-version";

interface Release {
  version: string;
  notes: string | null;
  released_at: string;
}

interface WorkerStatus {
  worker_id: string;
  worker_name: string;
  running_version: string | null;
  latest_seen_version: string | null;
  last_seen_at: string;
  notified_at: string | null;
}

const compareVersions = (a: string, b: string): number => {
  // Format: YYYY.MM.DD.HHmm – strängjämförelse fungerar
  if (a === b) return 0;
  return a > b ? 1 : -1;
};

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "nyss";
  if (min < 60) return `${min} min sen`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} tim sen`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d sen`;
  return formatLocalDateTime(iso);
};

const AdminVersions = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: releases = [] } = useQuery({
    queryKey: ["admin-releases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_releases")
        .select("version, notes, released_at")
        .order("released_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Release[];
    },
    refetchInterval: 30000,
  });

  const { data: workerStatuses = [] } = useQuery({
    queryKey: ["admin-worker-app-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_app_status")
        .select("worker_id, worker_name, running_version, latest_seen_version, last_seen_at, notified_at")
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkerStatus[];
    },
    refetchInterval: 30000,
  });

  const latestVersion = useMemo(() => {
    if (releases.length === 0) return APP_VERSION;
    return releases[0].version;
  }, [releases]);

  const statsByVersion = useMemo(() => {
    const map = new Map<string, { running: WorkerStatus[]; seen: WorkerStatus[] }>();
    for (const r of releases) {
      map.set(r.version, { running: [], seen: [] });
    }
    for (const w of workerStatuses) {
      if (w.running_version && map.has(w.running_version)) {
        map.get(w.running_version)!.running.push(w);
      }
      // En medarbetare har "sett" alla versioner som är <= deras latest_seen_version
      if (w.latest_seen_version) {
        for (const r of releases) {
          if (compareVersions(w.latest_seen_version, r.version) >= 0) {
            map.get(r.version)!.seen.push(w);
          }
        }
      }
    }
    return map;
  }, [releases, workerStatuses]);

  const totalWorkers = workerStatuses.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Versionshistorik</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Alla publicerade versioner, release-noter och vilka medarbetare som har sett versionenen och uppdaterat.
        </p>
      </div>

      {/* Aktiva medarbetares versioner */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-semibold">Medarbetarnas versioner</h3>
          <span className="text-xs text-muted-foreground">{totalWorkers} registrerade enheter</span>
        </div>
        {workerStatuses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Ingen aktivitet loggad ännu. Status registreras automatiskt när medarbetare öppnar appen.
          </p>
        ) : (
          <div className="divide-y divide-border -mx-2">
            {workerStatuses.map((w) => {
              const onLatest = w.running_version === latestVersion;
              const behind = w.running_version && compareVersions(w.running_version, latestVersion) < 0;
              return (
                <div key={w.worker_id} className="flex items-center justify-between gap-3 px-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{w.worker_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      v{w.running_version ?? "?"} • sedd {relativeTime(w.last_seen_at)}
                    </p>
                  </div>
                  {onLatest ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-0 shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Senaste
                    </Badge>
                  ) : behind ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-0 shrink-0">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Äldre version
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      <Clock className="h-3 w-3 mr-1" />
                      Okänd
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Releaser */}
      <Card className="p-5">
        <h3 className="text-base font-semibold mb-3">Publicerade versioner</h3>
        {releases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Inga versioner loggade ännu. När du publicerar en ny version loggas den automatiskt här.
          </p>
        ) : (
          <div className="space-y-2">
            {releases.map((r) => {
              const stats = statsByVersion.get(r.version) ?? { running: [], notified: [] };
              const isOpen = expanded === r.version;
              const isLatest = r.version === latestVersion;
              return (
                <div key={r.version} className="border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : r.version)}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-accent/40 transition-colors"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">v{r.version}</span>
                        {isLatest && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px]">
                            Aktuell
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {formatLocalDateTime(r.released_at)}
                        </span>
                      </div>
                      {r.notes && (
                        <p className="text-[13px] text-foreground/80 mt-1 leading-snug line-clamp-2">
                          {r.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span>
                          <span className="font-medium text-foreground">{stats.running.length}</span> kör
                        </span>
                        <span>
                          <span className="font-medium text-foreground">{stats.seen.length}</span> har sett versionen
                        </span>
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-muted/30 p-3 space-y-3">
                      {r.notes && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Release-noter</p>
                          <p className="text-sm whitespace-pre-wrap">{r.notes}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                            Kör v{r.version} ({stats.running.length})
                          </p>
                          {stats.running.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Ingen</p>
                          ) : (
                            <ul className="text-xs space-y-0.5">
                              {stats.running.map((w) => (
                                <li key={w.worker_id}>{w.worker_name}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                            Sett versionen ({stats.seen.length})
                          </p>
                          {stats.seen.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Ingen</p>
                          ) : (
                            <ul className="text-xs space-y-0.5">
                              {stats.seen.map((w) => (
                                <li key={w.worker_id}>{w.worker_name}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminVersions;
