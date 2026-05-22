import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { STANDARD_PLACES } from "@/lib/place-label";

const todayLocalIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatTime = (iso: string | null) => {
  if (!iso) return null;
  try {
    return format(new Date(iso), "HH:mm", { locale: sv });
  } catch {
    return null;
  }
};

interface EveningRoundWidgetProps {
  onOpen?: () => void;
}

const EveningRoundWidget = ({ onOpen }: EveningRoundWidgetProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const date = todayLocalIso();

  const { data: guests = [], isLoading: loadingGuests } = useQuery({
    queryKey: ["evening-round-widget-guests", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evening_round_guests")
        .select("id, status, place_label, payment_method, payment_amount")
        .lte("arrival_date", date)
        .gt("departure_date", date);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const { data: extraPlaces = [], isLoading: loadingExtra } = useQuery({
    queryKey: ["evening-round-widget-extra-places", date],
    queryFn: async () => {
      const { data: rounds } = await supabase
        .from("evening_rounds")
        .select("id")
        .eq("round_date", date);
      const ids = (rounds ?? []).map((r) => r.id);
      if (ids.length === 0) return [] as string[];
      const { data: extras } = await supabase
        .from("evening_round_extra_places")
        .select("label")
        .in("evening_round_id", ids);
      return Array.from(new Set((extras ?? []).map((e: any) => e.label as string)));
    },
    refetchInterval: 60000,
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["evening-round-widget-sessions", date],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("evening_round_sessions")
        .select("id, worker_id, session_start, session_end")
        .eq("round_date", date)
        .order("session_start", { ascending: true });
      if (error) throw error;
      const list = rows ?? [];
      if (list.length === 0) return [] as Array<{ worker_name: string | null; session_start: string | null; session_end: string | null }>;
      const ids = Array.from(new Set(list.map((s) => s.worker_id)));
      const { data: workers } = await supabase.from("workers").select("id, name").in("id", ids);
      const nameById = new Map((workers ?? []).map((w: any) => [w.id, w.name]));
      return list.map((s) => ({
        worker_name: nameById.get(s.worker_id) ?? null,
        session_start: s.session_start,
        session_end: s.session_end,
      }));
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("evening-round-widget")
      .on("postgres_changes", { event: "*", schema: "public", table: "evening_round_guests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["evening-round-widget-guests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "evening_round_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["evening-round-widget-sessions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "evening_round_extra_places" }, () => {
        queryClient.invalidateQueries({ queryKey: ["evening-round-widget-extra-places"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const stats = useMemo(() => {
    const allPlaces = Array.from(new Set([...STANDARD_PLACES, ...extraPlaces]));
    const assignedIds = new Set(
      guests.filter((g: any) => g.place_label && allPlaces.includes(g.place_label)).map((g: any) => g.id),
    );
    const booked = assignedIds.size;
    const free = Math.max(0, allPlaces.length - booked);
    const here = guests.filter((g: any) => g.status === "here").length;
    const not = guests.filter((g: any) => g.status === "not_here").length;
    const unpaid = guests.filter((g: any) => !g.payment_method || !g.payment_amount).length;
    return { total: booked + free, booked, free, here, not, unpaid };
  }, [guests, extraPlaces]);

  const completed = sessions.filter((s) => s.session_end).slice(-1)[0];
  const ongoing = sessions.filter((s) => s.session_start && !s.session_end).slice(-1)[0];
  const latest = completed ?? ongoing;
  const latestTime = formatTime(latest?.session_end ?? latest?.session_start ?? null);
  const latestName = latest?.worker_name;
  const isOngoing = !!ongoing && !completed;
  const startTime = formatTime(latest?.session_start ?? null);
  const endTime = formatTime(latest?.session_end ?? null);

  const handleClick = () => {
    if (onOpen) onOpen();
    navigate("/evening-round");
  };

  const loading = loadingGuests || loadingSessions || loadingExtra;

  const statusDot = stats.total === 0
    ? "bg-muted-foreground/40"
    : stats.here === 0
      ? "bg-[hsl(150_30%_45%)]"
      : "bg-[hsl(38_75%_50%)]";

  const Stat = ({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn" | "danger" | "ok" }) => {
    const toneCls =
      tone === "warn"
        ? "text-[hsl(38_75%_35%)]"
        : tone === "danger"
          ? "text-[hsl(8_55%_45%)]"
          : tone === "ok"
            ? "text-[hsl(183_25%_35%)]"
            : "text-foreground";
    return (
      <div className="rounded-xl border border-[hsl(260_25%_88%)] bg-background/60 px-2.5 py-2">
        <div className={`text-base font-semibold tabular-nums leading-none ${toneCls}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{label}</div>
      </div>
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Öppna kvällsrundan"
      className="group w-full text-left border rounded-2xl p-4 bg-[hsl(260_30%_97%)] border-[hsl(260_25%_88%)] transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[hsl(260_25%_90%)] flex items-center justify-center shrink-0">
          <Moon className="h-4 w-4 text-[hsl(260_30%_38%)]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Kvällsrundan ikväll</h3>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
          </div>

          {loading ? (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : stats.total === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">Inga platser registrerade för ikväll.</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Stat label="Alla" value={stats.total} />
              <Stat label="Upptagen" value={stats.booked} tone="warn" />
              <Stat label="Lediga" value={stats.free} tone="ok" />
              <Stat label="På plats" value={stats.here} tone="ok" />
              <Stat label="Ej kommit" value={stats.not} tone="warn" />
              <Stat label="Ej betalt" value={stats.unpaid} tone={stats.unpaid > 0 ? "danger" : "default"} />
            </div>
          )}

          <div className="mt-2.5 space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden />
              {latest && latestTime && latestName ? (
                <span className="text-muted-foreground">
                  {isOngoing ? "Pågår" : "Runda gjord"}{" "}
                  <span className="tabular-nums font-medium text-foreground">{latestTime}</span>{" "}
                  av <span className="font-medium text-foreground">{latestName}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Ingen runda startad ännu</span>
              )}
            </div>
            {latest && startTime && (
              <div className="pl-3 text-muted-foreground">
                Senaste session:{" "}
                <span className="tabular-nums font-medium text-foreground">{startTime}</span>
                {" – "}
                {endTime ? (
                  <span className="tabular-nums font-medium text-foreground">{endTime}</span>
                ) : (
                  <span className="font-medium text-[hsl(38_75%_40%)]">pågår</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default EveningRoundWidget;
