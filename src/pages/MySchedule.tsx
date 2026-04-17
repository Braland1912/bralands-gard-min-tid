import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek, isToday, isSameWeek, addDays } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { Skeleton } from "@/components/ui/skeleton";

type ShiftType = "morning" | "day" | "evening" | "off";

const SHIFT_CONFIG: Record<ShiftType, { start: string; label: string; chipBg: string; chipText: string; chipBorder: string }> = {
  morning: { start: "07", label: "Morgon", chipBg: "bg-[#DBEAFE]", chipText: "text-blue-800", chipBorder: "border-blue-200" },
  day: { start: "10", label: "Dag", chipBg: "bg-[#FEF9C3]", chipText: "text-yellow-800", chipBorder: "border-yellow-200" },
  evening: { start: "17", label: "Kväll", chipBg: "bg-[#EDE9FE]", chipText: "text-purple-800", chipBorder: "border-purple-200" },
  off: { start: "", label: "Ledigt", chipBg: "bg-gray-100", chipText: "text-gray-600", chipBorder: "border-gray-200" },
};

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const ShiftCell = ({ shift, isToday: today }: { shift: ShiftType | null; isToday?: boolean }) => {
  if (!shift) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-2 px-1 min-h-[56px] ${
          today ? "ring-2 ring-primary" : ""
        }`}
      >
        <span className="text-xs text-gray-300">–</span>
      </div>
    );
  }
  const cfg = SHIFT_CONFIG[shift];
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-white border border-border py-2 px-1 min-h-[56px] ${
        today ? "ring-2 ring-primary" : ""
      }`}
    >
      <span
        className={`inline-flex items-center justify-center min-w-[40px] h-7 px-2 rounded-full border ${cfg.chipBg} ${cfg.chipText} ${cfg.chipBorder} text-xs font-semibold`}
      >
        {shift === "off" ? "Ledigt" : cfg.start}
      </span>
    </div>
  );
};

const MySchedule = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: worker } = useWorker(user?.id);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const referenceDate = useMemo(() => {
    const now = new Date();
    if (weekOffset === 0) return now;
    return weekOffset > 0 ? addWeeks(now, weekOffset) : subWeeks(now, Math.abs(weekOffset));
  }, [weekOffset]);

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(referenceDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 });

  const { data: allWorkers = [] } = useQuery({
    queryKey: ["all-workers-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getShift = (userId: string, date: Date): ShiftType | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = schedules.find((s: any) => s.user_id === userId && s.date === dateStr);
    if (!entry) return null;
    const t = entry.shift_type as string;
    if (["morning", "day", "evening", "off"].includes(t)) return t as ShiftType;
    return null;
  };

  const myUserId = user?.id;
  const canSeeTeam = worker?.can_see_team === true;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={{ colorScheme: "light" }}>
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-5">
        {!isCurrentWeek && (
          <button
            onClick={() => setWeekOffset(0)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Tillbaka till idag
          </button>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => setWeekOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">Vecka {weekNumber}</div>
            <div className="text-xs text-muted-foreground">
              {format(weekStart, "d MMM", { locale: sv })} – {format(weekEnd, "d MMM", { locale: sv })} · {format(weekStart, "yyyy")}
            </div>
          </div>
          <button onClick={() => setWeekOffset((o) => o + 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((d, i) => {
            const today = isToday(d);
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">{DAY_NAMES[i]}</span>
                <span className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {format(d, "d")}
                </span>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Din vecka</h2>
          {schedulesLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d, i) => {
                const shift = myUserId ? getShift(myUserId, d) : null;
                const today = isToday(d);
                return <ShiftCell key={i} shift={shift} isToday={today} />;
              })}
            </div>
          )}
        </div>

        {canSeeTeam && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Hela teamet</h2>
            <div className="space-y-3">
              {allWorkers.map((w: any) => {
                const isMe = w.user_id === myUserId;
                return (
                  <Card key={w.id} className={`p-4 ${isMe ? "ring-2 ring-primary" : ""}`}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(w.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{w.name}</span>
                        {isMe && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            Du
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {weekDays.map((d, i) => {
                        const shift = w.user_id ? getShift(w.user_id, d) : null;
                        const today = isToday(d);
                        return <ShiftCell key={i} shift={shift} isToday={today} />;
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MySchedule;
