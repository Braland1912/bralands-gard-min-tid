import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { Pencil, Check, X, Download, ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { calcWorkedMinutes, sumBreakMinutes, type BreakInterval } from "@/lib/workedTime";

const db = supabase as any;

// Format hours with Swedish decimal comma, e.g. 7.5 -> "7,5"
const fmtHours = (h: number, decimals = 2) =>
  h.toFixed(decimals).replace(".", ",");

const SalaryReport = () => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

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

  const { data: workers = [], isLoading: workersLoading } = useQuery({
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

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
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

  // Hämta rast-loggar för alla pass i perioden. En logg räknas som rast om
  // dess kategori har is_break = true (kategorin kan vara inaktiverad senare,
  // is_break gäller ändå).
  const entryIds = useMemo(
    () => entries.filter((e) => e.clock_out).map((e) => e.id),
    [entries],
  );

  const { data: breakLogs = [], isLoading: breaksLoading } = useQuery({
    queryKey: ["salary-break-logs", selectedMonth, entryIds],
    enabled: entryIds.length > 0,
    queryFn: async (): Promise<
      Array<BreakInterval & { time_entry_id: string }>
    > => {
      const { data, error } = await db
        .from("activity_logs")
        .select(
          "time_entry_id, started_at, ended_at, category_label, task_categories!inner(is_break)",
        )
        .in("time_entry_id", entryIds)
        .eq("task_categories.is_break", true);
      if (error) {
        toast.error("Kunde inte hämta rast-loggar");
        throw error;
      }
      return (data ?? []).map((row: any) => ({
        time_entry_id: row.time_entry_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        category_label: row.category_label,
        is_break: true,
      }));
    },
  });

  const breaksByEntry = useMemo(() => {
    const map = new Map<string, BreakInterval[]>();
    for (const log of breakLogs) {
      const list = map.get(log.time_entry_id) || [];
      list.push(log);
      map.set(log.time_entry_id, list);
    }
    return map;
  }, [breakLogs]);

  const updateRateMutation = useMutation({
    mutationFn: async ({ workerId, rate }: { workerId: string; rate: number }) => {
      const { error } = await supabase
        .from("workers")
        .update({ hourly_rate: rate })
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
    const summary = new Map<
      string,
      { name: string; totalHours: number; breakHours: number; hourlyRate: number }
    >();

    entries.forEach((entry) => {
      if (!entry.clock_in || !entry.clock_out) return;
      const passBreaks = breaksByEntry.get(entry.id) ?? [];
      const workedMin = calcWorkedMinutes(entry.clock_in, entry.clock_out, passBreaks);
      const breakMin = sumBreakMinutes(entry.clock_in, entry.clock_out, passBreaks);

      const worker = workerMap.get(entry.worker_id);
      const rate = worker?.hourly_rate ?? 0;

      const existing = summary.get(entry.worker_id) || {
        name: entry.worker_name,
        totalHours: 0,
        breakHours: 0,
        hourlyRate: rate,
      };

      summary.set(entry.worker_id, {
        ...existing,
        totalHours: existing.totalHours + workedMin / 60,
        breakHours: existing.breakHours + breakMin / 60,
      });
    });

    return Array.from(summary.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, workers, breaksByEntry]);

  const entriesByWorker = useMemo(() => {
    const map = new Map<string, typeof entries>();
    entries.forEach((entry) => {
      if (!entry.clock_in || !entry.clock_out) return;
      const list = map.get(entry.worker_id) || [];
      list.push(entry);
      map.set(entry.worker_id, list);
    });
    return map;
  }, [entries]);

  const toggleExpanded = (workerId: string) => {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const totalHours = salaryData.reduce((sum, w) => sum + w.totalHours, 0);
  const totalBreakHours = salaryData.reduce((sum, w) => sum + w.breakHours, 0);
  const totalEarned = salaryData.reduce((sum, w) => sum + w.totalHours * w.hourlyRate, 0);

  const isLoading = workersLoading || entriesLoading || (entryIds.length > 0 && breaksLoading);

  const exportSalaryCSV = () => {
    const headers = [
      "Namn",
      "Arbetade timmar",
      "Varav rast (h)",
      "Timlön (kr)",
      "Totalt intjänat (kr)",
    ];
    const rows = salaryData.map((w) => [
      w.name,
      fmtHours(w.totalHours),
      fmtHours(w.breakHours),
      w.hourlyRate.toFixed(0),
      (w.totalHours * w.hourlyRate).toFixed(0),
    ]);
    rows.push([
      "Totalt",
      fmtHours(totalHours),
      fmtHours(totalBreakHours),
      "—",
      totalEarned.toFixed(0),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lonerapport-${selectedMonth}.csv`;
    a.click();
  };

  const selectedMonthLabel =
    monthOptions.find((m) => m.value === selectedMonth)?.label ?? selectedMonth;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Lönerapport</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger
              aria-label="Välj månad"
              className="flex-1 sm:flex-none sm:w-[220px] h-12 text-base rounded-xl border-border"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl p-2">
              {monthOptions.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-1">
                  <div className="text-sm font-medium text-foreground">Inga månader att visa</div>
                  <div className="text-xs text-muted-foreground">
                    Månader dyker upp här när det finns avslutade pass.
                  </div>
                </div>
              ) : (
                monthOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="h-12 px-3 my-0.5 rounded-lg text-base font-medium pl-9 capitalize data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold"
                  >
                    {opt.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="lg"
            onClick={exportSalaryCSV}
            disabled={salaryData.length === 0}
            className="h-12 rounded-xl gap-2 shrink-0"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground capitalize">
        Visar {selectedMonthLabel} • {salaryData.length} medarbetare
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : salaryData.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center rounded-2xl border border-dashed border-border bg-muted/20">
          <DollarSign className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-foreground font-medium">Inga avslutade pass</p>
          <p className="text-sm text-muted-foreground mt-1 capitalize">för {selectedMonthLabel}</p>
          <p className="text-xs text-muted-foreground mt-2">Välj en annan månad i listan ovan</p>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {salaryData.map((worker) => (
              <Card
                key={worker.id}
                className="p-4 space-y-2 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => toggleExpanded(worker.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {expandedWorkers.has(worker.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold text-foreground">{worker.name}</span>
                  </div>
                  <span className="font-bold text-foreground">{(worker.totalHours * worker.hourlyRate).toFixed(0)} kr</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground pl-6">
                  <div className="flex flex-col">
                    <span>{fmtHours(worker.totalHours)} h</span>
                    {worker.breakHours > 0 && (
                      <span className="text-xs">varav rast {fmtHours(worker.breakHours)} h</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {editingWorkerId === worker.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          className="w-16 h-7 text-right text-xs"
                          min={0}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateRateMutation.mutate({ workerId: worker.id, rate: Number(editRate) })}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingWorkerId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => { setEditingWorkerId(worker.id); setEditRate(String(worker.hourlyRate)); }}
                      >
                        <span>{worker.hourlyRate.toFixed(0)} kr/h</span>
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {expandedWorkers.has(worker.id) && (
                  <div className="pl-6 pt-1 space-y-1 border-t border-border">
                    {(entriesByWorker.get(worker.id) || []).map((entry) => {
                      const passBreaks = breaksByEntry.get(entry.id) ?? [];
                      const workedH = calcWorkedMinutes(entry.clock_in!, entry.clock_out!, passBreaks) / 60;
                      const breakH = sumBreakMinutes(entry.clock_in!, entry.clock_out!, passBreaks) / 60;
                      return (
                        <div key={entry.id} className="flex justify-between text-xs text-muted-foreground py-1">
                          <span>{format(new Date(entry.clock_in!), "d MMM", { locale: sv })} · {format(new Date(entry.clock_in!), "HH:mm")}–{format(new Date(entry.clock_out!), "HH:mm")}</span>
                          <span>
                            {fmtHours(workedH)} h
                            {breakH > 0 && <span className="opacity-70"> (rast {fmtHours(breakH)} h)</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
            <Card className="p-4 flex justify-between items-center bg-muted/50">
              <span className="font-bold text-foreground">Totalt</span>
              <div className="text-right">
                <p className="font-bold text-foreground">{totalEarned.toFixed(0)} kr</p>
                <p className="text-xs text-muted-foreground">
                  {fmtHours(totalHours)} h
                  {totalBreakHours > 0 && <> · varav rast {fmtHours(totalBreakHours)} h</>}
                </p>
              </div>
            </Card>
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead className="text-right">Arbetade timmar</TableHead>
                  <TableHead className="text-right text-muted-foreground">Varav rast</TableHead>
                  <TableHead className="text-right">Timlön (kr)</TableHead>
                  <TableHead className="text-right">Totalt intjänat (kr)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryData.map((worker) => (
                  <React.Fragment key={worker.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => toggleExpanded(worker.id)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {expandedWorkers.has(worker.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          {worker.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{fmtHours(worker.totalHours)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {worker.breakHours > 0 ? `${fmtHours(worker.breakHours)} h` : "—"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {editingWorkerId === worker.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input type="number" value={editRate} onChange={(e) => setEditRate(e.target.value)} className="w-20 h-8 text-right" min={0} />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateRateMutation.mutate({ workerId: worker.id, rate: Number(editRate) })}><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingWorkerId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span>{worker.hourlyRate.toFixed(0)}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingWorkerId(worker.id); setEditRate(String(worker.hourlyRate)); }}><Pencil className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{(worker.totalHours * worker.hourlyRate).toFixed(0)} kr</TableCell>
                    </TableRow>
                    {expandedWorkers.has(worker.id) && (entriesByWorker.get(worker.id) || []).map((entry) => {
                      const passBreaks = breaksByEntry.get(entry.id) ?? [];
                      const workedH = calcWorkedMinutes(entry.clock_in!, entry.clock_out!, passBreaks) / 60;
                      const breakH = sumBreakMinutes(entry.clock_in!, entry.clock_out!, passBreaks) / 60;
                      return (
                        <TableRow key={entry.id} className="bg-muted/20 text-sm">
                          <TableCell className="pl-12 text-muted-foreground">{format(new Date(entry.clock_in!), "d MMM yyyy", { locale: sv })}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmtHours(workedH)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{breakH > 0 ? `${fmtHours(breakH)} h` : "—"}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{format(new Date(entry.clock_in!), "HH:mm")} – {format(new Date(entry.clock_out!), "HH:mm")}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{(workedH * worker.hourlyRate).toFixed(0)} kr</TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell>Totalt</TableCell>
                  <TableCell className="text-right">{fmtHours(totalHours)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {totalBreakHours > 0 ? `${fmtHours(totalBreakHours)} h` : "—"}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">{totalEarned.toFixed(0)} kr</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default SalaryReport;
