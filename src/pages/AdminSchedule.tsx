import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, ArrowLeft, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek, isToday, isSameWeek, addDays } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type ShiftType = "morning" | "day" | "evening" | "busy" | "off";

const SHIFT_OPTIONS: { type: ShiftType; emoji: string; label: string; time: string; bg: string; border: string; text: string }[] = [
  { type: "morning", emoji: "🌅", label: "Morgon", time: "06–14", bg: "bg-orange-50", border: "border-yellow-300", text: "text-orange-700" },
  { type: "day", emoji: "☀️", label: "Dag", time: "10–18", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  { type: "evening", emoji: "🌙", label: "Kväll", time: "14–22", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  { type: "busy", emoji: "🔒", label: "Upptagen", time: "Hel dag", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  { type: "off", emoji: "💤", label: "Ledigt", time: "", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400" },
];

const SHIFT_MAP = Object.fromEntries(SHIFT_OPTIONS.map((s) => [s.type, s]));
const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const FULL_DAY_NAMES = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const AdminSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [sheet, setSheet] = useState<{ worker: any; date: Date; dayIndex: number } | null>(null);

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

  const { data: allWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["admin-workers-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["admin-schedules", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
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
    return entry ? (entry.shift_type as ShiftType) : null;
  };

  const upsertShift = useMutation({
    mutationFn: async ({ userId, date, shiftType }: { userId: string; date: string; shiftType: ShiftType }) => {
      const { error } = await supabase
        .from("schedules")
        .upsert({ user_id: userId, date, shift_type: shiftType }, { onConflict: "user_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
      setSheet(null);
    },
    onError: () => {
      toast({ title: "Kunde inte spara", description: "Försök igen eller kontrollera din behörighet.", variant: "destructive" });
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ workerId, canSeeTeam }: { workerId: string; canSeeTeam: boolean }) => {
      const { error } = await supabase
        .from("workers")
        .update({ can_see_team: canSeeTeam } as any)
        .eq("id", workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-workers-schedule"] });
    },
  });

  const isLoading = workersLoading || schedulesLoading;

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-[480px] mx-auto px-4 py-6 space-y-5">
        {/* Back to today */}
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

        {/* Worker cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {allWorkers.map((w: any) => (
              <Card key={w.id} className="p-4">
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {getInitials(w.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold text-foreground">{w.name}</span>
                </div>

                {/* Shift grid */}
                <div className="grid grid-cols-7 gap-1.5 mb-3">
                  {weekDays.map((d, i) => {
                    const shift = w.user_id ? getShift(w.user_id, d) : null;
                    const today = isToday(d);
                    const cfg = shift ? SHIFT_MAP[shift] : null;
                    return (
                      <button
                        key={i}
                        onClick={() => w.user_id && setSheet({ worker: w, date: d, dayIndex: i })}
                        className={`flex flex-col items-center justify-center rounded-xl border py-2 px-1 min-h-[68px] transition-colors ${
                          cfg
                            ? `${cfg.border} ${cfg.bg} ${today ? "ring-2 ring-primary" : ""}`
                            : `border-dashed border-gray-200 bg-gray-50/50 ${today ? "ring-2 ring-primary" : ""}`
                        }`}
                      >
                        <span className="text-[9px] text-muted-foreground font-medium mb-0.5">{format(d, "d")}</span>
                        {cfg ? (
                          <>
                            <span className="text-base leading-none">{cfg.emoji}</span>
                            <span className={`text-[9px] font-semibold mt-0.5 ${cfg.text}`}>{cfg.label}</span>
                            {cfg.time && <span className={`text-[8px] ${cfg.text} opacity-70`}>{cfg.time}</span>}
                          </>
                        ) : (
                          <span className="text-xs text-gray-300">+</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Visibility toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">Kan se teamets schema</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${w.can_see_team ? "text-blue-600" : "text-gray-400"}`}>
                      {w.can_see_team ? "Ja" : "Nej"}
                    </span>
                    <Switch
                      checked={w.can_see_team ?? true}
                      onCheckedChange={(checked) =>
                        toggleVisibility.mutate({ workerId: w.id, canSeeTeam: checked })
                      }
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-[20px] border-t border-border p-5 pb-8 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="text-center mb-5">
              <div className="text-base font-semibold text-foreground">{sheet.worker.name}</div>
              <div className="text-sm text-muted-foreground">
                {FULL_DAY_NAMES[sheet.dayIndex]} · {format(sheet.date, "d MMM yyyy", { locale: sv })}
              </div>
            </div>

            {/* Shift options */}
            <div className="space-y-2 mb-5">
              {SHIFT_OPTIONS.map((opt) => {
                const currentShift = sheet.worker.user_id ? getShift(sheet.worker.user_id, sheet.date) : null;
                const isSelected = currentShift === opt.type;
                return (
                  <button
                    key={opt.type}
                    onClick={() =>
                      upsertShift.mutate({
                        userId: sheet.worker.user_id,
                        date: format(sheet.date, "yyyy-MM-dd"),
                        shiftType: opt.type,
                      })
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                      isSelected ? "bg-blue-50 border-blue-200" : "bg-card border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <div className="flex-1 text-left">
                      <span className={`text-sm font-medium ${isSelected ? "text-blue-700" : "text-foreground"}`}>
                        {opt.label}
                      </span>
                      {opt.time && (
                        <span className="text-xs text-muted-foreground ml-2">{opt.time}</span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>

            {/* Cancel */}
            <Button variant="outline" className="w-full" onClick={() => setSheet(null)}>
              Avbryt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSchedule;
