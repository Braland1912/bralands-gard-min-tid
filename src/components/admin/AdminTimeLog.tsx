import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Calendar, Clock, Pencil, Trash2, Plus, Loader2, Save, CalendarDays, CalendarRange, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { sv } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import MonthlySummary from "@/components/MonthlySummary";
import EntryActivityLog from "@/components/admin/EntryActivityLog";
import { cn } from "@/lib/utils";

type FilterMode = "all" | "today" | "week" | "custom";

const AdminTimeLog = () => {
  const [selectedWorker, setSelectedWorker] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [deleteEntry, setDeleteEntry] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addWorkerId, setAddWorkerId] = useState("");
  const [addClockIn, setAddClockIn] = useState("");
  const [addClockOut, setAddClockOut] = useState("");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleEntryExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["time_entries", selectedWorker, filterMode, selectedDate],
    queryFn: async () => {
      let query = supabase.from("time_entries").select("*").order("clock_in", { ascending: false });
      if (selectedWorker !== "all") query = query.eq("worker_id", selectedWorker);

      let start: Date | null = null;
      let end: Date | null = null;
      // Bygg datum i LOKAL tid så att "YYYY-MM-DD" alltid matchar exakt den dagen
      // i svensk tid (annars tolkas ISO-strängen som UTC och kan hamna en dag fel).
      const localDayStart = (iso: string) => {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
      };
      const localDayEnd = (iso: string) => {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d, 23, 59, 59, 999);
      };
      if (filterMode === "today") {
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (filterMode === "week") {
        const now = new Date();
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if ((filterMode === "custom" || filterMode === "all") && selectedDate) {
        start = localDayStart(selectedDate);
        end = localDayEnd(selectedDate);
      }
      if (start && end) {
        query = query.gte("clock_in", start.toISOString()).lte("clock_in", end.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["time_entries"] });

  const updateMutation = useMutation({
    mutationFn: async ({ id, clock_in, clock_out }: { id: string; clock_in: string; clock_out: string | null }) => {
      const update: any = { clock_in: new Date(clock_in).toISOString() };
      if (clock_out) update.clock_out = new Date(clock_out).toISOString();
      else update.clock_out = null;
      const { error } = await supabase.from("time_entries").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditEntry(null);
      toast({ title: "Stämpling uppdaterad" });
    },
    onError: (e: any) => toast({ title: "Fel", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDeleteEntry(null);
      toast({ title: "Stämpling raderad" });
    },
    onError: (e: any) => toast({ title: "Fel", description: e.message, variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const worker = workers.find((w) => w.id === addWorkerId);
      if (!worker) throw new Error("Välj en medarbetare");
      if (!addClockIn) throw new Error("Ange in-tid");
      const insert: any = {
        worker_id: worker.id,
        worker_name: worker.name,
        clock_in: new Date(addClockIn).toISOString(),
      };
      if (addClockOut) insert.clock_out = new Date(addClockOut).toISOString();
      const { error } = await supabase.from("time_entries").insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setShowAdd(false);
      setAddWorkerId("");
      setAddClockIn("");
      setAddClockOut("");
      toast({ title: "Stämpling tillagd" });
    },
    onError: (e: any) => toast({ title: "Fel", description: e.message, variant: "destructive" }),
  });

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setEditClockIn(entry.clock_in ? toLocalDatetime(entry.clock_in) : "");
    setEditClockOut(entry.clock_out ? toLocalDatetime(entry.clock_out) : "");
  };

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, typeof entries>();
    entries.forEach((entry) => {
      const day = entry.clock_in ? format(new Date(entry.clock_in), "yyyy-MM-dd") : "unknown";
      const list = groups.get(day) || [];
      list.push(entry);
      groups.set(day, list);
    });
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const exportToCSV = () => {
    const headers = ["Namn", "Datum", "In", "Ut", "Timmar"];
    const rows = entries.map((e) => {
      const hours = e.clock_in && e.clock_out
        ? ((new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000).toFixed(2)
        : "";
      return [
        e.worker_name,
        e.clock_in ? format(new Date(e.clock_in), "yyyy-MM-dd") : "",
        e.clock_in ? format(new Date(e.clock_in), "HH:mm") : "",
        e.clock_out ? format(new Date(e.clock_out), "HH:mm") : "",
        hours,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tidslogg-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Tidslogg</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Lägg till</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: "all", label: "Alla", icon: null },
          { id: "today", label: "Idag", icon: Calendar },
          { id: "week", label: "Denna vecka", icon: CalendarRange },
          { id: "custom", label: "Anpassat datum", icon: CalendarDays },
        ] as { id: FilterMode; label: string; icon: any }[]).map((chip) => {
          const active = filterMode === chip.id;
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              onClick={() => {
                setFilterMode(chip.id);
                if (chip.id !== "custom") setSelectedDate("");
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-foreground border-border hover:bg-muted/70"
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Medarbetare
          </label>
          <p className="text-xs text-muted-foreground">
            Välj en person eller visa alla.
          </p>
          <div className="flex items-center gap-2">
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger
                aria-label="Välj medarbetare"
                className="h-12 text-base rounded-xl border-border flex-1"
              >
                <SelectValue placeholder="Alla medarbetare" />
              </SelectTrigger>
              <SelectContent className="max-h-[60vh] p-2 rounded-xl">
                <SelectItem
                  value="all"
                  className="h-12 px-3 my-0.5 rounded-lg text-base font-medium pl-9 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold"
                >
                  Alla medarbetare ({workers.length})
                </SelectItem>
                {workers.length === 0 ? (
                  <div className="py-8 px-4 text-center space-y-1">
                    <div className="text-sm font-medium text-foreground">Inga medarbetare ännu</div>
                    <div className="text-xs text-muted-foreground">
                      Bjud in personal via "Team" för att kunna filtrera här.
                    </div>
                  </div>
                ) : (
                  workers.map((w) => (
                    <SelectItem
                      key={w.id}
                      value={w.id}
                      className="h-12 px-3 my-0.5 rounded-lg text-base font-medium pl-9 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold"
                    >
                      {w.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedWorker !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedWorker("all")}
                className="h-12 rounded-xl px-3 shrink-0 text-muted-foreground"
                aria-label="Rensa medarbetarfilter"
              >
                Rensa
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Datum
          </label>
          <p className="text-xs text-muted-foreground">
            Välj specifikt datum eller använd snabbfilter ovan. Matchar exakt den valda dagen i lokal tid.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (e.target.value) setFilterMode("custom");
                  else if (filterMode === "custom") setFilterMode("all");
                }}
                aria-label="Välj datum"
                placeholder="ÅÅÅÅ-MM-DD"
                className="input-datetime h-12 pl-9"
              />
            </div>
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedDate("");
                  if (filterMode === "custom") setFilterMode("all");
                }}
                className="h-12 rounded-xl px-3 shrink-0 text-muted-foreground"
                aria-label="Rensa datumfilter"
              >
                Rensa
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Aktiv filter-summering */}
      {(selectedWorker !== "all" || filterMode !== "all" || selectedDate) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Aktiva filter:</span>
          {selectedWorker !== "all" && (
            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {workers.find((w: any) => w.id === selectedWorker)?.name ?? "Medarbetare"}
            </span>
          )}
          {filterMode !== "all" && (
            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {filterMode === "today" && "Idag"}
              {filterMode === "week" && "Denna vecka"}
              {filterMode === "custom" && selectedDate && (() => {
                const [y, m, d] = selectedDate.split("-").map(Number);
                return format(new Date(y, m - 1, d), "d MMM yyyy", { locale: sv });
              })()}
              {filterMode === "custom" && !selectedDate && "Anpassat datum"}
            </span>
          )}
          <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
            Tider visas i lokal tid (Europe/Stockholm)
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedWorker("all");
              setFilterMode("all");
              setSelectedDate("");
            }}
            className="text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Rensa alla
          </button>
        </div>
      )}

      {/* Månadssammanställning för vald medarbetare */}
      {selectedWorker !== "all" && (() => {
        const w = workers.find((x: any) => x.id === selectedWorker);
        if (!w) return null;
        return (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Sammanställning per månad — {w.name}
            </p>
            <MonthlySummary
              workerId={w.id}
              showPay
              hourlyRate={Number(w.hourly_rate ?? 0)}
            />
          </div>
        );
      })()}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : groupedByDay.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Inga tidsposter hittades</p>
          <p className="text-sm text-muted-foreground">Ändra filter för att visa poster</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDay.map(([day, dayEntries]) => (
            <div key={day} className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {day !== "unknown" ? format(new Date(day), "EEEE d MMMM", { locale: sv }) : "Okänt datum"}
              </p>
              <div className="space-y-2">
                {dayEntries.map((entry) => {
                  const hours = entry.clock_in && entry.clock_out
                    ? ((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000)
                    : null;
                  return (
                    <Card key={entry.id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleEntryExpanded(entry.id)}
                          aria-expanded={expandedEntries.has(entry.id)}
                          aria-label={expandedEntries.has(entry.id) ? "Dölj arbetslogg" : "Visa arbetslogg"}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left -m-1 p-1 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              expandedEntries.has(entry.id) && "rotate-180",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{entry.worker_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {entry.clock_in ? format(new Date(entry.clock_in), "HH:mm") : "–"} — {entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : <span className="text-primary font-medium">Aktiv</span>}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-1">
                            {hours !== null ? (
                              <p className="font-semibold text-foreground text-sm">{hours.toFixed(2)} h</p>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                                <p className="text-xs text-primary font-medium">Pågående</p>
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(entry)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteEntry(entry)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {expandedEntries.has(entry.id) && entry.clock_in && (
                        <EntryActivityLog
                          timeEntryId={entry.id}
                          clockIn={entry.clock_in}
                          clockOut={entry.clock_out}
                          enabled
                        />
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redigera stämpling</DialogTitle>
            <DialogDescription>{editEntry?.worker_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5 min-w-0">
              <label className="text-sm font-medium text-foreground">In</label>
              <Input type="datetime-local" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} placeholder="ÅÅÅÅ-MM-DD HH:MM" className="input-datetime h-12" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="text-sm font-medium text-foreground">Ut</label>
              <Input type="datetime-local" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} placeholder="ÅÅÅÅ-MM-DD HH:MM" className="input-datetime h-12" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Avbryt</Button>
            <Button
              onClick={() => editEntry && updateMutation.mutate({ id: editEntry.id, clock_in: editClockIn, clock_out: editClockOut || null })}
              disabled={updateMutation.isPending || !editClockIn}
              className="gap-1.5"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera stämpling?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteEntry && (
                <>Stämpling för <strong>{deleteEntry.worker_name}</strong> den {deleteEntry.clock_in ? format(new Date(deleteEntry.clock_in), "d MMMM HH:mm", { locale: sv }) : "okänt"} tas bort permanent.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lägg till stämpling</DialogTitle>
            <DialogDescription>Skapa en manuell tidsstämpling</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Medarbetare</label>
              <Select value={addWorkerId} onValueChange={setAddWorkerId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Välj medarbetare" />
                </SelectTrigger>
                <SelectContent className="max-h-[60vh] p-2 rounded-xl">
                  {workers.length === 0 ? (
                    <div className="py-8 px-4 text-center space-y-1">
                      <div className="text-sm font-medium text-foreground">Inga medarbetare</div>
                      <div className="text-xs text-muted-foreground">
                        Lägg till personal under "Team" innan du skapar stämplingar.
                      </div>
                    </div>
                  ) : (
                    workers.map((w) => (
                      <SelectItem
                        key={w.id}
                        value={w.id}
                        className="h-12 px-3 my-0.5 rounded-lg text-base font-medium pl-9 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold"
                      >
                        {w.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="text-sm font-medium text-foreground">In</label>
              <Input type="datetime-local" value={addClockIn} onChange={(e) => setAddClockIn(e.target.value)} placeholder="ÅÅÅÅ-MM-DD HH:MM" className="input-datetime h-12" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="text-sm font-medium text-foreground">Ut (valfritt)</label>
              <Input type="datetime-local" value={addClockOut} onChange={(e) => setAddClockOut(e.target.value)} placeholder="ÅÅÅÅ-MM-DD HH:MM" className="input-datetime h-12" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Avbryt</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !addWorkerId || !addClockIn}
              className="gap-1.5"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Lägg till
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTimeLog;
