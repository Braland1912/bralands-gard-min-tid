import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Clock, Power, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { sv } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { Skeleton } from "@/components/ui/skeleton";

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
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!worker,
  });

  // Today's entries for summary
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

  // Monthly total
  const monthTotal = entries.reduce((sum, e) => {
    if (e.clock_in && e.clock_out) {
      return sum + (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
    }
    return sum;
  }, 0);

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
      if (!worker) throw new Error("No worker");
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
      toast({ title: "Skickat", description: "Din begäran har skickats till admin." });
      setOpen(false);
      setFormDate("");
      setFormClockIn("");
      setFormClockOut("");
      setFormReason("");
    },
    onError: (err: Error) => {
      toast({ title: "Fel", description: err.message, variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-primary text-primary-foreground">Godkänd</Badge>;
      case "denied": return <Badge variant="destructive">Nekad</Badge>;
      default: return <Badge variant="secondary">Väntar</Badge>;
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-5">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Min tid</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <Power className="h-4 w-4 mr-1" />
            Logga ut
          </Button>
        </div>

        {/* Today & month summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">Idag</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{todayStats.totalH.toFixed(1)} h</p>
            {todayStats.activeStart && (
              <p className="text-[11px] text-primary font-medium">
                ● Aktiv sedan {new Date(todayStats.activeStart).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div className="bg-muted/50 rounded-xl p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">Denna månad</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{monthTotal.toFixed(1)} h</p>
          </div>
        </div>

        {/* Time entries */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Tidrapport – {format(now, "MMMM yyyy", { locale: sv })}
          </h2>
          {entriesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Inga poster denna månad</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => {
                const hours = e.clock_in && e.clock_out
                  ? ((new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000)
                  : null;
                return (
                  <Card key={e.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {e.clock_in ? format(new Date(e.clock_in), "d MMM", { locale: sv }) : "–"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {e.clock_in ? format(new Date(e.clock_in), "HH:mm") : "–"} — {e.clock_out ? format(new Date(e.clock_out), "HH:mm") : <span className="text-primary font-medium">Aktiv</span>}
                      </p>
                    </div>
                    <p className="font-semibold text-foreground">
                      {hours ? `${hours.toFixed(1)} h` : "–"}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Correction requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Korrigeringsförfrågningar</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Rapportera
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Rapportera saknad tid</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }}
                >
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Datum</label>
                    <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className="h-12" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Instämpling</label>
                      <Input type="time" value={formClockIn} onChange={(e) => setFormClockIn(e.target.value)} className="h-12" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Utstämpling</label>
                      <Input type="time" value={formClockOut} onChange={(e) => setFormClockOut(e.target.value)} className="h-12" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Anledning</label>
                    <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} required placeholder="T.ex. glömde stämpla in" className="rounded-xl" />
                  </div>
                  <Button type="submit" disabled={submitMutation.isPending} size="lg" className="w-full">
                    {submitMutation.isPending ? "Skickar..." : "Skicka förfrågan"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {corrections.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Inga korrigeringsförfrågningar ännu</p>
            </div>
          ) : (
            <div className="space-y-2">
              {corrections.map((c: any) => (
                <Card key={c.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{c.date}</p>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.clock_in ? format(new Date(c.clock_in), "HH:mm") : "–"} — {c.clock_out ? format(new Date(c.clock_out), "HH:mm") : "–"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{c.reason}</p>
                  {c.admin_note && (
                    <p className="text-sm text-foreground italic">Admin: {c.admin_note}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTime;
