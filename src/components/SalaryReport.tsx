import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { Pencil, Check, X } from "lucide-react";

const SalaryReport = () => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");

  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: sv }),
      });
    }
    return options;
  }, []);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-with-rate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["salary-entries", selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split("-").map(Number);
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(new Date(year, month - 1));

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const updateRateMutation = useMutation({
    mutationFn: async ({ workerId, rate }: { workerId: string; rate: number }) => {
      const { error } = await supabase
        .from("workers")
        .update({ hourly_rate: rate } as any)
        .eq("id", workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers-with-rate"] });
      toast.success("Timlön uppdaterad");
      setEditingWorkerId(null);
    },
    onError: () => toast.error("Kunde inte uppdatera timlön"),
  });

  const salaryData = useMemo(() => {
    const workerMap = new Map(workers.map((w) => [w.id, w]));

    const summary = new Map<string, { name: string; totalHours: number; hourlyRate: number }>();

    entries.forEach((entry) => {
      if (!entry.clock_in || !entry.clock_out) return;
      const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
      const worker = workerMap.get(entry.worker_id);
      const rate = (worker as any)?.hourly_rate ?? 0;

      const existing = summary.get(entry.worker_id) || {
        name: entry.worker_name,
        totalHours: 0,
        hourlyRate: rate,
      };

      summary.set(entry.worker_id, {
        ...existing,
        totalHours: existing.totalHours + hours,
      });
    });

    return Array.from(summary.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, workers]);

  const totalEarned = salaryData.reduce((sum, w) => sum + w.totalHours * w.hourlyRate, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Lönerapport</h2>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Namn</TableHead>
              <TableHead className="text-right">Totala timmar</TableHead>
              <TableHead className="text-right">Timlön (kr)</TableHead>
              <TableHead className="text-right">Totalt intjänat (kr)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaryData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Inga avslutade pass denna månad
                </TableCell>
              </TableRow>
            ) : (
              salaryData.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell className="text-right">{worker.totalHours.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {editingWorkerId === worker.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          className="w-20 h-8 text-right"
                          min={0}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => updateRateMutation.mutate({ workerId: worker.id, rate: Number(editRate) })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingWorkerId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <span>{worker.hourlyRate.toFixed(0)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingWorkerId(worker.id);
                            setEditRate(String(worker.hourlyRate));
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {(worker.totalHours * worker.hourlyRate).toFixed(0)} kr
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {salaryData.length > 0 && (
        <Card className="p-4 flex justify-between items-center">
          <span className="font-medium text-foreground">Total lönekostnad denna månad</span>
          <span className="text-xl font-bold text-foreground">{totalEarned.toFixed(0)} kr</span>
        </Card>
      )}
    </div>
  );
};

export default SalaryReport;
