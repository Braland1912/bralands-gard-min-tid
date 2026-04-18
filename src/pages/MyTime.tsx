import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Clock, Power, FileText, Loader2, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/TimePicker";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, getISOWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { Skeleton } from "@/components/ui/skeleton";
import ShiftChecklists from "@/components/ShiftChecklists";

const MyTime = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: worker } = useWorker(user?.id);

  const [open, setOpen] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formClockIn, setFormClockIn] = useState("");
  const [formClockOut, setFormClockOut] = useState("");
  const [formReason, setFormReason] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["my-time-entries", worker?.id, monthStart],
    queryFn: async () => {
      if (!worker) return [];
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("worker_id", worker.id)
        .gte("clock_in", monthStart)
        .lte("clock_in", monthEnd)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!worker,
  });

  const { data: todayEntries = [] } = useQuery({
    queryKey: ["my-today-entries", worker?.id],
    queryFn: async () => {
      if (!worker) return [];
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .eq("worker_id", worker.id)
        .gte("clock_in", todayStart)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!worker,
    refetchInterval: 30000,
  });

  const todayDateStr = format(now, "yyyy-MM-dd");
  const { data: todayShifts = [] } = useQuery({
    queryKey: ["my-today-shifts", user?.id, todayDateStr],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayDateStr)
        .order("shift_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const todayShiftIds = (todayShifts as any[]).map((s) => s.id);
  const { data: todayChecklistMap = {} } = useQuery({
    queryKey: ["my-today-checklists-presence", todayShiftIds.join(",")],
    queryFn: async () => {
      if (todayShiftIds.length === 0) return {} as Record<string, boolean>;
      const { data, error } = await supabase
        .from("shift_checklists")
        .select("shift_id")
        .in("shift_id", todayShiftIds);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: any) => {
        map[r.shift_id] = true;
      });
      return map;
    },
    enabled: todayShiftIds.length > 0,
  });

  const todayStats = (() => {
    let totalMs = 0;
    let activeStart: string | null = null;
    for (const e of todayEntries) {
      if (e.clock_in && e.clock_out) {
        totalMs += new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
      } else if (e.clock_in && !e.clock_out) {
        activeStart = e.clock_in;
        totalMs += Date.now() - new Date(e.clock_in).getTime();
      }
    }
    return { totalH: totalMs / 3600000, activeStart };
  })();

  const monthTotal = entries.reduce((sum, e) => {
    if (e.clock_in && e.clock_out) {
      return sum + (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
    }
    return sum;
  }, 0);

  // Group entries by day, then by week
  const groupedByWeek = useMemo(() => {
    const dayMap = new Map<string, typeof entries>();
    entries.forEach((entry) => {
      const day = entry.clock_in ? format(new Date(entry.clock_in), "yyyy-MM-dd") : "unknown";
      const list = dayMap.get(day) || [];
      list.push(entry);
      dayMap.set(day, list);
    });

    const sortedDays = Array.from(dayMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    const weekMap = new Map<number, { days: typeof sortedDays; totalHours: number }>();
    sortedDays.forEach(([day, dayEntries]) => {
      if (day === "unknown") return;
      const weekNum = getISOWeek(new Date(day));
      const existing = weekMap.get(weekNum) || { days: [], totalHours: 0 };
      let dayTotal = 0;
      dayEntries.forEach((e) => {
        if (e.clock_in && e.clock_out) {
          dayTotal += (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
        }
      });
      existing.days.push([day, dayEntries]);
      existing.totalHours += dayTotal;
      weekMap.set(weekNum, existing);
    });

    return Array.from(weekMap.entries()).sort((a, b) => b[0] - a[0]);
  }, [entries]);

  const { data: corrections = [] } = useQuery({
    queryKey: ["my-corrections", worker?.id],
    queryFn: async () => {
      if (!worker) return [];
      const { data, error } = await supabase
        .from("time_correction_requests")
        .select("*")
        .eq("worker_id", worker.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!worker,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!worker) throw new Error("Inget konto hittat");
      const payload: Record<string, unknown> = {
        worker_id: worker.id,
        worker_name: worker.name,
        date: formDate,
        reason: formReason,
      };
      if (formClockIn) payload.clock_in = new Date(`${formDate}T${formClockIn}`).toISOString();
      if (formClockOut) payload.clock_out = new Date(`${formDate}T${formClockOut}`).toISOString();
      const { error } = await supabase.from("time_correction_requests").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-corrections"] });
      toast({ title: "Inskickat", description: "Din rättelse har skickats till din arbetsledare." });
      setOpen(false);
      setFormDate("");
      setFormClockIn("");
      setFormClockOut("");
      setFormReason("");
    },
    onError: (err: Error) => {
      toast({ title: "Kunde inte skicka", description: "Kontrollera att alla falt ar ifyllda och forsok igen.", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-primary text-primary-foreground">Godkand</Badge>;
      case "denied": return <Badge variant="destructive">Nekad</Badge>;
      default: return <Badge variant="secondary">Vantar</Badge>;
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Min tid</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground rounded-xl">
            <Power className="h-4 w-4 mr-1.5" />
            Logga ut
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border rounded-xl p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">Idag</span>
            </div>
            <p className="text-xl font-semibold text-foreground tabular-nums">{todayStats.totalH.toFixed(1)} h</p>
            {todayStats.activeStart && (
              <p className="text-[11px] text-primary font-medium">
                Aktiv sedan {new Date(todayStats.activeStart).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div className="border border-border rounded-xl p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">Denna manad</span>
            </div>
            <p className="text-xl font-semibold text-foreground tabular-nums">{monthTotal.toFixed(1)} h</p>
          </div>
        </div>

        {/* Today's checklists */}
        {(todayShifts as any[]).filter((s) => todayChecklistMap[s.id]).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Dagens checklistor</h2>
            {(todayShifts as any[])
              .filter((s) => todayChecklistMap[s.id])
              .map((s) => (
                <div key={s.id} className="border border-border rounded-xl p-4">
                  <ShiftChecklists shiftId={s.id} mode="worker" />
                </div>
              ))}
          </div>
        )}

        {/* Correction requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Rattelser</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-xl">
                  <Plus className="h-4 w-4" />
                  Ny rattelse
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Rapportera saknad tid</DialogTitle>
                  <DialogDescription>Fyll i vilken tid du jobbade sa fixar din arbetsledare det</DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }}
                >
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Datum</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-12 w-full justify-start font-normal",
                            !formDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                          {formDate
                            ? format(new Date(formDate + "T00:00:00"), "EEEE d MMMM yyyy", { locale: sv })
                            : "Välj datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                        <Calendar
                          mode="single"
                          locale={sv}
                          weekStartsOn={1}
                          selected={formDate ? new Date(formDate + "T00:00:00") : undefined}
                          onSelect={(d) => {
                            if (!d) return;
                            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                            setFormDate(iso);
                          }}
                          disabled={(d) => d > new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Stämplade in</label>
                      <TimePicker value={formClockIn} onChange={setFormClockIn} placeholder="--:--" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Stämplade ut</label>
                      <TimePicker value={formClockOut} onChange={setFormClockOut} placeholder="--:--" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Vad hande?</label>
                    <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} required placeholder="T.ex. glomde stampla in nar jag borjade" className="rounded-xl" />
                  </div>
                  <Button type="submit" disabled={submitMutation.isPending} size="lg" className="w-full">
                    {submitMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Skickar...</>
                    ) : "Skicka"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {corrections.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Inga rattelser an</p>
              <p className="text-xs text-muted-foreground mt-1">Om du glomt stampla kan du skicka en rattelse har</p>
            </div>
          ) : (
            <div className="space-y-2">
              {corrections.map((c: any) => (
                <div key={c.id} className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{c.date}</p>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {c.clock_in ? format(new Date(c.clock_in), "HH:mm") : "–"} – {c.clock_out ? format(new Date(c.clock_out), "HH:mm") : "–"}
                  </p>
                  <p className="text-sm text-muted-foreground">{c.reason}</p>
                  {c.admin_note && (
                    <p className="text-sm text-foreground border-t border-border pt-2 mt-2">Svar: {c.admin_note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Time entries grouped by week → day */}
        <div className="space-y-6">
          <h2 className="text-base font-semibold text-foreground">
            Tidrapport – {format(now, "MMMM yyyy", { locale: sv })}
          </h2>

          {entriesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : groupedByWeek.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Inga pass registrerade an</p>
              <p className="text-sm text-muted-foreground mt-1">Har dyker dina arbetade pass upp nar du borjat stampla</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByWeek.map(([weekNum, weekData]) => (
                <div key={weekNum} className="space-y-3">
                  {weekData.days.map(([day, dayEntries]) => {
                    const dayTotal = dayEntries.reduce((sum, e) => {
                      if (e.clock_in && e.clock_out) {
                        return sum + (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
                      }
                      return sum;
                    }, 0);
                    const hasActive = dayEntries.some(e => !e.clock_out);

                    return (
                      <div key={day} className="border border-border rounded-xl overflow-hidden">
                        {/* Day header */}
                        <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground capitalize">
                            {format(new Date(day), "EEEE d MMMM", { locale: sv })}
                          </p>
                          <p className="text-sm font-semibold text-foreground tabular-nums">
                            {hasActive ? (
                              <span className="text-primary">Pagar</span>
                            ) : (
                              `${dayTotal.toFixed(1)} h`
                            )}
                          </p>
                        </div>
                        {/* Entries */}
                        <div className="divide-y divide-border">
                          {dayEntries.map((e) => {
                            const hours = e.clock_in && e.clock_out
                              ? ((new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000)
                              : null;
                            return (
                              <div key={e.id} className="px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                                    <span>{e.clock_in ? format(new Date(e.clock_in), "HH:mm") : "–"}</span>
                                    <span>–</span>
                                    <span>{e.clock_out ? format(new Date(e.clock_out), "HH:mm") : <span className="text-primary font-medium">nu</span>}</span>
                                  </div>
                                </div>
                                <p className="text-sm font-medium text-foreground tabular-nums">
                                  {hours ? `${hours.toFixed(1)} h` : ""}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Week total */}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vecka {weekNum}</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{weekData.totalHours.toFixed(1)} h</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTime;
