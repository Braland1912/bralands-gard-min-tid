import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { sv } from "date-fns/locale";
import type { User } from "@supabase/supabase-js";

const MyTime = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formClockIn, setFormClockIn] = useState("");
  const [formClockOut, setFormClockOut] = useState("");
  const [formReason, setFormReason] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const { data: worker } = useQuery({
    queryKey: ["my-worker", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: entries = [] } = useQuery({
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
      if (formClockIn) {
        payload.clock_in = new Date(`${formDate}T${formClockIn}`).toISOString();
      }
      if (formClockOut) {
        payload.clock_out = new Date(`${formDate}T${formClockOut}`).toISOString();
      }
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
      case "approved": return <Badge className="bg-green-600">Godkänd</Badge>;
      case "denied": return <Badge variant="destructive">Nekad</Badge>;
      default: return <Badge variant="secondary">Väntar</Badge>;
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Min tid</h1>
        </div>

        {/* Current month entries */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Tidrapport – {format(now, "MMMM yyyy", { locale: sv })}
          </h2>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Ut</TableHead>
                  <TableHead>Timmar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Inga poster denna månad
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((e) => {
                    const hours = e.clock_in && e.clock_out
                      ? ((new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000).toFixed(2)
                      : null;
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{e.clock_in ? format(new Date(e.clock_in), "dd MMM", { locale: sv }) : "–"}</TableCell>
                        <TableCell>{e.clock_in ? format(new Date(e.clock_in), "HH:mm") : "–"}</TableCell>
                        <TableCell>{e.clock_out ? format(new Date(e.clock_out), "HH:mm") : <span className="text-primary font-medium">Aktiv</span>}</TableCell>
                        <TableCell>{hours ? `${hours} h` : "–"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Submit correction request */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Korrigeringsförfrågningar</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Rapportera saknad tid
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rapportera saknad tid</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitMutation.mutate();
                  }}
                >
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Datum</label>
                    <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Instämpling</label>
                      <Input type="time" value={formClockIn} onChange={(e) => setFormClockIn(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Utstämpling</label>
                      <Input type="time" value={formClockOut} onChange={(e) => setFormClockOut(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Anledning</label>
                    <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} required placeholder="T.ex. glömde stämpla in" />
                  </div>
                  <Button type="submit" disabled={submitMutation.isPending} className="w-full">
                    {submitMutation.isPending ? "Skickar..." : "Skicka förfrågan"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {corrections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga korrigeringsförfrågningar ännu.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Ut</TableHead>
                    <TableHead>Anledning</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.date}</TableCell>
                      <TableCell>{c.clock_in ? format(new Date(c.clock_in), "HH:mm") : "–"}</TableCell>
                      <TableCell>{c.clock_out ? format(new Date(c.clock_out), "HH:mm") : "–"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.reason}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MyTime;
