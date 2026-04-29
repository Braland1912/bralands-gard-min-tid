import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const todayLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const CreateRoundDialog = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [workerId, setWorkerId] = useState<string>("");
  const [time, setTime] = useState("18:00");

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-round"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: existing, isFetching: checking } = useQuery({
    queryKey: ["evening-round-check", date, workerId],
    queryFn: async () => {
      if (!date || !workerId) return null;
      const { data, error } = await supabase
        .from("evening_rounds")
        .select("id, round_time")
        .eq("round_date", date)
        .eq("assigned_worker_id", workerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!date && !!workerId,
  });

  useEffect(() => {
    if (existing?.round_time) {
      setTime(String(existing.round_time).slice(0, 5));
    }
  }, [existing]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workerId || !date) throw new Error("Välj datum och ansvarig");
      if (existing) {
        // Uppdatera tid om den ändrats
        const { data, error } = await supabase
          .from("evening_rounds")
          .update({ round_time: time })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        return { round: data, created: false };
      }
      const { data, error } = await supabase
        .from("evening_rounds")
        .insert({
          assigned_worker_id: workerId,
          round_date: date,
          round_time: time,
        })
        .select("*")
        .single();
      if (error) throw error;
      return { round: data, created: true };
    },
    onSuccess: ({ created }) => {
      toast.success(created ? "Runda skapad" : "Runda uppdaterad");
      queryClient.invalidateQueries({ queryKey: ["evening-round"] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-check"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte skapa runda"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <CalendarPlus className="h-4 w-4" />
          Skapa runda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa kvällsrunda</DialogTitle>
          <DialogDescription>
            Välj datum och ansvarig medarbetare. Om en runda redan finns för valt
            datum och person uppdateras tiden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="round-date">Datum</Label>
              <Input
                id="round-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="round-time">Tid</Label>
              <Input
                id="round-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="round-worker">Ansvarig</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger id="round-worker">
                <SelectValue placeholder="Välj medarbetare…" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {workerId && !checking && (
            <p
              className={`text-xs ${
                existing ? "text-amber-600" : "text-muted-foreground"
              }`}
            >
              {existing
                ? "En runda finns redan – tiden uppdateras vid spar."
                : "Ingen runda finns – en ny skapas."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={createMutation.isPending}
          >
            Avbryt
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!workerId || !date || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            {existing ? "Uppdatera" : "Skapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoundDialog;
