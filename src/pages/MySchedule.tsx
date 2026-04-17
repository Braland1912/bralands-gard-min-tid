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

type ShiftType = "morning" | "day" | "evening" | "busy" | "off";

const SHIFT_CONFIG: Record<ShiftType, { emoji: string; label: string; bg: string; border: string; text: string }> = {
  morning: { emoji: "🌅", label: "Morgon", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  day: { emoji: "☀️", label: "Dag", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  evening: { emoji: "🌙", label: "Kväll", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  busy: { emoji: "🔒", label: "Upptagen", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  off: { emoji: "💤", label: "Ledigt", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400" },
};

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

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

  const { data: scheduleDays = [] } = useQuery({
    queryKey: ["schedule-days", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_days")
        .select("*")
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isDayPublished = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const row = scheduleDays.find((d: any) => d.date === dateStr);
    return row?.is_published === true;
  };

  const getShiftAt = (userId: string, date: Date, idx: 0 | 1): ShiftType | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = schedules.find(
      (s: any) => s.user_id === userId && s.date === dateStr && (s.shift_index ?? 0) === idx,
    );
    return entry ? (entry.shift_type as ShiftType) : null;
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

  const Chip = ({ shift, full }: { shift: ShiftType; full?: boolean }) => {
    const cfg = SHIFT_CONFIG[shift];
    return (
      <div
        className={`w-full rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col items-center justify-center px-1 ${
          full ? "flex-1 py-2" : "py-1"
        }`}
      >
        <span className={`leading-none ${full ? "text-base" : "text-sm"}`}>{cfg.emoji}</span>
        <span className={`font-semibold mt-0.5 ${cfg.text} text-[10px]`}>{cfg.label}</span>
      </div>
    );
  };

  const DayCell = ({
    userId,
    date,
    today,
  }: {
    userId: string | null | undefined;
    date: Date;
    today: boolean;
  }) => {
    const published = isDayPublished(date);

    if (!published) {
      return (
        <div
          className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 min-h-[68px] px-1 ${
            today ? "ring-2 ring-primary" : ""
          }`}
        >
          <span className="text-base leading-none">🔒</span>
          <span className="text-[10px] italic text-muted-foreground mt-1">Ej klar</span>
        </div>
      );
    }

    const s0 = userId ? getShiftAt(userId, date, 0) : null;
    const s1 = userId ? getShiftAt(userId, date, 1) : null;
    const hasAny = !!s0 || !!s1;
    const onlyOne = hasAny && !(s0 && s1);

    if (!hasAny) {
      return (
        <div
          className={`flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 min-h-[68px] ${
            today ? "ring-2 ring-primary" : ""
          }`}
        >
          <span className="text-xs text-gray-300">–</span>
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col gap-1 min-h-[68px] rounded-xl ${today ? "ring-2 ring-primary" : ""}`}
      >
        {s0 && <Chip shift={s0} full={onlyOne} />}
        {s1 && <Chip shift={s1} full={onlyOne} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-5">
        {!isCurrentWeek && (
          <button
            onClick={() => setWeekOffset(0)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Tillbaka till idag
          </button>
        )}

        {/* Week navigator */}
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

        {/* Day strip */}
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

        {/* DIN VECKA */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Din vecka</h2>
          {schedulesLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d, i) => (
                <DayCell key={i} userId={myUserId} date={d} today={isToday(d)} />
              ))}
            </div>
          )}
        </div>

        {/* HELA TEAMET */}
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
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                            Du
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {weekDays.map((d, i) => (
                        <DayCell key={i} userId={w.user_id} date={d} today={isToday(d)} />
                      ))}
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
