import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getISOWeek, isToday, isSameWeek, addDays } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type ShiftType = "morning" | "day" | "evening" | "off";

type ShiftCfg = {
  type: ShiftType;
  start: string; // "07" | "10" | "17"
  label: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
};

const SHIFTS: ShiftCfg[] = [
  { type: "morning", start: "07", label: "Morgon", chipBg: "bg-[#DBEAFE]", chipText: "text-blue-800", chipBorder: "border-blue-200" },
  { type: "day", start: "10", label: "Dag", chipBg: "bg-[#FEF9C3]", chipText: "text-yellow-800", chipBorder: "border-yellow-200" },
  { type: "evening", start: "17", label: "Kväll", chipBg: "bg-[#EDE9FE]", chipText: "text-purple-800", chipBorder: "border-purple-200" },
  { type: "off", start: "", label: "Ledigt", chipBg: "bg-gray-100", chipText: "text-gray-600", chipBorder: "border-gray-200" },
];

const SHIFT_MAP: Record<ShiftType, ShiftCfg> = SHIFTS.reduce(
  (acc, s) => ({ ...acc, [s.type]: s }),
  {} as Record<ShiftType, ShiftCfg>,
);

const TIME_SHIFTS = SHIFTS.filter((s) => s.type !== "off");

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const Chip = ({ shift }: { shift: ShiftType }) => {
  const cfg = SHIFT_MAP[shift];
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[40px] h-7 px-2 rounded-full border ${cfg.chipBg} ${cfg.chipText} ${cfg.chipBorder} text-xs font-semibold`}
    >
      {shift === "off" ? "Ledigt" : cfg.start}
    </span>
  );
};

const AdminSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [openCell, setOpenCell] = useState<string | null>(null);

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
      const { data, error } = await supabase.from("workers").select("*").order("name");
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
      setOpenCell(null);
    },
    onError: () => {
      toast({ title: "Kunde inte spara", description: "Försök igen eller kontrollera din behörighet.", variant: "destructive" });
    },
  });

  const deleteShift = useMutation({
    mutationFn: async ({ userId, date }: { userId: string; date: string }) => {
      const { error } = await supabase.from("schedules").delete().eq("user_id", userId).eq("date", date);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schedules"] });
      setOpenCell(null);
    },
    onError: () => {
      toast({ title: "Kunde inte ta bort", variant: "destructive" });
    },
  });

  const isLoading = workersLoading || schedulesLoading;

  const cellKey = (userId: string, date: Date) => `${userId}_${format(date, "yyyy-MM-dd")}`;

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Schema</h1>
            <p className="text-xs text-muted-foreground">Planera arbetspass per medarbetare</p>
          </div>
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Idag
              </button>
            )}
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="text-center min-w-[140px]">
                <div className="text-sm font-semibold text-foreground">Vecka {weekNumber}</div>
                <div className="text-[11px] text-muted-foreground">
                  {format(weekStart, "d MMM", { locale: sv })} – {format(weekEnd, "d MMM", { locale: sv })}
                </div>
              </div>
              <button onClick={() => setWeekOffset((o) => o + 1)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Header row */}
              <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b border-border bg-muted/30">
                <div className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Medarbetare
                </div>
                {weekDays.map((d, i) => {
                  const today = isToday(d);
                  return (
                    <div key={i} className={`px-2 py-3 text-center border-l border-border ${today ? "bg-primary/5" : ""}`}>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        {DAY_NAMES[i]}
                      </div>
                      <div className="mt-0.5 flex justify-center">
                        <span
                          className={`text-sm font-semibold w-7 h-7 inline-flex items-center justify-center rounded-full ${
                            today ? "bg-primary text-primary-foreground" : "text-foreground"
                          }`}
                        >
                          {format(d, "d")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Body */}
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : allWorkers.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Inga medarbetare att visa.</div>
              ) : (
                allWorkers.map((w: any) => (
                  <div
                    key={w.id}
                    className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    <div className="px-4 py-3 flex items-center gap-2.5 sticky left-0 bg-card">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(w.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground truncate">{w.name}</span>
                    </div>

                    {weekDays.map((d, i) => {
                      const shift = w.user_id ? getShift(w.user_id, d) : null;
                      const today = isToday(d);
                      const key = w.user_id ? cellKey(w.user_id, d) : "";
                      const isOpen = openCell === key;
                      const dateStr = format(d, "yyyy-MM-dd");

                      const cellInner = (
                        <button
                          disabled={!w.user_id}
                          className={`w-full border-l border-border min-h-[64px] p-1.5 flex items-center justify-center transition-colors ${
                            today ? "bg-primary/[0.03]" : ""
                          } ${w.user_id ? "hover:bg-primary/5 cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                        >
                          {shift ? <Chip shift={shift} /> : <span className="text-muted-foreground/40 text-lg">+</span>}
                        </button>
                      );

                      if (!w.user_id) return <div key={i}>{cellInner}</div>;

                      return (
                        <Popover
                          key={i}
                          open={isOpen}
                          onOpenChange={(o) => setOpenCell(o ? key : null)}
                        >
                          <PopoverTrigger asChild>{cellInner}</PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="center">
                            {shift ? (
                              <EditPopover
                                currentShift={shift}
                                onChange={(newType) =>
                                  upsertShift.mutate({ userId: w.user_id, date: dateStr, shiftType: newType })
                                }
                                onDelete={() => deleteShift.mutate({ userId: w.user_id, date: dateStr })}
                                saving={upsertShift.isPending || deleteShift.isPending}
                              />
                            ) : (
                              <CreatePopover
                                onPick={(type) =>
                                  upsertShift.mutate({ userId: w.user_id, date: dateStr, shiftType: type })
                                }
                                saving={upsertShift.isPending}
                              />
                            )}
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const CreatePopover = ({
  onPick,
  saving,
}: {
  onPick: (t: ShiftType) => void;
  saving: boolean;
}) => {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground px-1 pb-1">Välj pass</div>
      {SHIFTS.map((s) => (
        <button
          key={s.type}
          disabled={saving}
          onClick={() => onPick(s.type)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border hover:bg-muted/60 transition-colors text-left disabled:opacity-50`}
        >
          <Chip shift={s.type} />
          <span className="text-sm text-foreground">
            {s.type === "off" ? "Ledigt" : `${s.label} (${s.start})`}
          </span>
        </button>
      ))}
    </div>
  );
};

const EditPopover = ({
  currentShift,
  onChange,
  onDelete,
  saving,
}: {
  currentShift: ShiftType;
  onChange: (t: ShiftType) => void;
  onDelete: () => void;
  saving: boolean;
}) => {
  const isOff = currentShift === "off";
  const startValue = isOff ? "07" : SHIFT_MAP[currentShift].start;

  const handleStart = (val: string) => {
    const next = TIME_SHIFTS.find((s) => s.start === val);
    if (next) onChange(next.type);
  };

  const handleToggleOff = (checked: boolean) => {
    onChange(checked ? "off" : "morning");
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground px-1">Redigera pass</div>

      <div className="space-y-1.5">
        <Label className="text-xs">Starttid</Label>
        <Select value={startValue} onValueChange={handleStart} disabled={isOff || saving}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_SHIFTS.map((s) => (
              <SelectItem key={s.start} value={s.start}>
                {s.start} – {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <Label htmlFor="off-toggle" className="text-sm cursor-pointer">Ledigt</Label>
        <Switch id="off-toggle" checked={isOff} onCheckedChange={handleToggleOff} disabled={saving} />
      </div>

      <button
        onClick={onDelete}
        disabled={saving}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        Ta bort
      </button>
    </div>
  );
};

export default AdminSchedule;
