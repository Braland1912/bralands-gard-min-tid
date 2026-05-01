import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, ChevronRight, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

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

  // Gäster aktiva för datumet (samma logik som useEveningRoundGuests)
  const { data: guests = [], isLoading: loadingGuests } = useQuery({
    queryKey: ["evening-round-widget-guests", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evening_round_guests")
        .select("id, status")
        .lte("arrival_date", date)
        .gt("departure_date", date);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  // Sessioner för dagen + workers för namn
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

  // Realtime-uppdatering så widgeten alltid är fräsch
  useEffect(() => {
    const ch = supabase
      .channel("evening-round-widget")
      .on("postgres_changes", { event: "*", schema: "public", table: "evening_round_guests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["evening-round-widget-guests"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "evening_round_sessions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["evening-round-widget-sessions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const total = guests.length;
  const here = guests.filter((g: any) => g.status === "here").length;
  const notHere = guests.filter((g: any) => g.status === "not_here").length;
  const handled = notHere;

  // Hitta senaste avslutade runda (annars senaste startade)
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

  const loading = loadingGuests || loadingSessions;

  // Färg på status-prick
  const statusDot = total === 0
    ? "bg-muted-foreground/40"
    : handled === total
      ? "bg-[hsl(150_30%_45%)]"
      : "bg-[hsl(38_75%_50%)]";

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
            <div className="mt-2 space-y-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-44" />
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">Inga gäster registrerade för ikväll.</p>
          ) : (
            <>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-semibold tabular-nums text-[hsl(260_30%_28%)]">
                  {handled}/{total}
                </span>
                <span className="text-xs text-muted-foreground">avbockade</span>
              </div>

              <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Circle className="h-3 w-3 text-[hsl(183_25%_45%)] fill-[hsl(183_25%_45%)]" />
                  <span className="tabular-nums font-medium text-foreground">{here}</span> kvar
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-[hsl(150_30%_45%)]" />
                  <span className="tabular-nums font-medium text-foreground">{checkedOut}</span> ut
                </span>
                {notHere > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-[hsl(8_55%_55%)]" />
                    <span className="tabular-nums font-medium text-foreground">{notHere}</span> inte här
                  </span>
                )}
              </div>
            </>
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
