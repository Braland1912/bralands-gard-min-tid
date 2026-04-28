import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, X, ListChecks, Trash2 } from "lucide-react";

type FilterMode = "all" | "early" | "normal";

const EARLY_PREFIX = "Tidig utstämpling med obockade punkter";

const isEarlyClockout = (r: any) =>
  typeof r?.reason === "string" && r.reason.startsWith(EARLY_PREFIX);

const parseEarlyReason = (reason: string) => {
  const match = reason.match(/^Tidig utstämpling med obockade punkter \((\d+) st\):\s*(.*)$/s);
  if (match) {
    return { uncheckedCount: Number(match[1]), text: match[2].trim() };
  }
  return { uncheckedCount: null as number | null, text: reason.replace(EARLY_PREFIX, "").trim() };
};

const TimeCorrectionRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedWorker, setSelectedWorker] = useState<string>("all");
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["correction-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_correction_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter by selected worker
  const workerFiltered = useMemo(
    () => (selectedWorker === "all" ? requests : requests.filter((r: any) => r.worker_id === selectedWorker)),
    [requests, selectedWorker]
  );

  const handleAction = useMutation({
    mutationFn: async ({ id, action, request }: { id: string; action: "approved" | "denied"; request: any }) => {
      const note = adminNotes[id] || null;

      const { error: updateError } = await supabase
        .from("time_correction_requests")
        .update({ status: action, admin_note: note })
        .eq("id", id);
      if (updateError) throw updateError;

      if (action === "approved" && !isEarlyClockout(request) && (request.clock_in || request.clock_out)) {
        const dayStart = new Date(`${request.date}T00:00:00`).toISOString();
        const dayEnd = new Date(`${request.date}T23:59:59.999`).toISOString();

        const { data: openEntries, error: fetchError } = await supabase
          .from("time_entries")
          .select("id, clock_in")
          .eq("worker_id", request.worker_id)
          .is("clock_out", null)
          .gte("clock_in", dayStart)
          .lte("clock_in", dayEnd)
          .order("clock_in", { ascending: true })
          .limit(1);
        if (fetchError) throw fetchError;

        const openEntry = openEntries?.[0];

        if (openEntry && (request.clock_in || request.clock_out)) {
          const updates: { clock_in?: string; clock_out?: string } = {};
          if (request.clock_in) updates.clock_in = request.clock_in;
          if (request.clock_out) updates.clock_out = request.clock_out;

          const { error: updErr } = await supabase
            .from("time_entries")
            .update(updates)
            .eq("id", openEntry.id);
          if (updErr) throw updErr;
        } else if (request.clock_in) {
          const { error: insertError } = await supabase.from("time_entries").insert({
            worker_id: request.worker_id,
            worker_name: request.worker_name,
            clock_in: request.clock_in,
            clock_out: request.clock_out,
          });
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: (_, { action, request }) => {
      queryClient.invalidateQueries({ queryKey: ["correction-requests"] });
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      queryClient.invalidateQueries({ queryKey: ["active-entry"] });
      queryClient.invalidateQueries({ queryKey: ["my-today-hours"] });
      queryClient.invalidateQueries({ queryKey: ["my-today-entries"] });
      const isEarly = isEarlyClockout(request);
      toast({
        title: action === "approved" ? (isEarly ? "Kvitterad" : "Godkänd") : "Nekad",
        description: action === "approved"
          ? (isEarly ? "Notisen är markerad som hanterad." : "Tidposten har skapats.")
          : "Förfrågan har nekats.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Fel", description: err.message, variant: "destructive" });
    },
  });

  // Cleanup old requests (>30 days, all statuses).
  // Compute cutoff exactly when needed so N always matches what DELETE will affect.
  const buildCutoffIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  };

  // Live count from the server using the SAME predicate as DELETE (created_at < cutoff).
  // This guarantees N matches the rows that will actually be removed, regardless of
  // local cache staleness, pagination or null created_at values.
  const { data: oldCount = 0, refetch: refetchOldCount } = useQuery({
    queryKey: ["correction-requests-old-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("time_correction_requests")
        .select("id", { count: "exact", head: true })
        .lt("created_at", buildCutoffIso());
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const cutoffIso = buildCutoffIso();
      const { error, count } = await supabase
        .from("time_correction_requests")
        .delete({ count: "exact" })
        .lt("created_at", cutoffIso);
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["correction-requests"] });
      queryClient.invalidateQueries({ queryKey: ["correction-requests-old-count"] });
      queryClient.invalidateQueries({ queryKey: ["pending-corrections-counts"] });
      setCleanupOpen(false);
      toast({ title: `Rensade ${count} gamla rättelser` });
    },
    onError: (err: Error) => {
      toast({ title: "Fel", description: err.message, variant: "destructive" });
    },
  });

  const handleCleanupClick = async () => {
    // Refetch right before opening so the dialog shows a fresh, authoritative N.
    const { data } = await refetchOldCount();
    const fresh = data ?? 0;
    if (fresh === 0) {
      toast({ title: "Inga gamla rättelser att rensa" });
      return;
    }
    setCleanupOpen(true);
  };

  const earlyPending = workerFiltered.filter((r: any) => r.status === "pending" && isEarlyClockout(r));
  const normalPending = workerFiltered.filter((r: any) => r.status === "pending" && !isEarlyClockout(r));
  const handledRequests = workerFiltered.filter((r: any) => r.status !== "pending");

  const showEarly = filter === "all" || filter === "early";
  const showNormal = filter === "all" || filter === "normal";
  const filteredHandled = handledRequests.filter((r: any) => {
    if (filter === "early") return isEarlyClockout(r);
    if (filter === "normal") return !isEarlyClockout(r);
    return true;
  });

  const totalEarly = workerFiltered.filter((r: any) => isEarlyClockout(r)).length;
  const totalNormal = workerFiltered.filter((r: any) => !isEarlyClockout(r)).length;

  return (
    <div className="space-y-4 pb-24 md:pb-6 max-w-full overflow-x-hidden">
      {/* Filter chips + cleanup button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as FilterMode)}
          className="justify-start gap-2 flex-wrap"
        >
          <ToggleGroupItem value="all" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-full px-4 h-9 text-sm border">
            Alla
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{workerFiltered.length}</Badge>
          </ToggleGroupItem>
          <ToggleGroupItem value="early" className="data-[state=on]:bg-amber-500 data-[state=on]:text-white rounded-full px-4 h-9 text-sm border">
            <ListChecks className="h-3.5 w-3.5 mr-1" />
            <span className="md:hidden">Tidiga</span>
            <span className="hidden md:inline">Tidiga utstämplingar</span>
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{totalEarly}</Badge>
          </ToggleGroupItem>
          <ToggleGroupItem value="normal" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-full px-4 h-9 text-sm border">
            <span className="md:hidden">Rättelser</span>
            <span className="hidden md:inline">Korrigeringar</span>
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{totalNormal}</Badge>
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCleanupClick}
          disabled={oldCount === 0}
          className="gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Rensa gamla</span>
        </Button>
      </div>

      {/* Worker filter */}
      <div className="w-full sm:max-w-xs">
        <Select value={selectedWorker} onValueChange={setSelectedWorker}>
          <SelectTrigger className="h-12 text-base rounded-xl border-border">
            <SelectValue placeholder="Alla medarbetare" />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh] p-2 rounded-xl">
            <SelectItem
              value="all"
              className="h-12 px-3 my-0.5 rounded-lg text-base font-medium pl-9 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold"
            >
              Alla medarbetare
            </SelectItem>
            {workers.map((w: any) => (
              <SelectItem
                key={w.id}
                value={w.id}
                className="h-12 px-3 my-0.5 rounded-lg text-base font-medium pl-9 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold"
              >
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tidig utstämpling — egen sektion */}
      {showEarly && (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-amber-600" />
          Tidiga utstämplingar
          {earlyPending.length > 0 && (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs">
              {earlyPending.length} ny{earlyPending.length === 1 ? "" : "a"}
            </Badge>
          )}
        </h2>
        <p className="text-xs text-muted-foreground -mt-1">
          Notiser från medarbetare som stämplat ut med obockade checklist-punkter.
        </p>

        {earlyPending.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground text-center">
            Inga nya notiser om tidig utstämpling.
          </Card>
        ) : (
          <div className="space-y-3">
            {earlyPending.map((r: any) => {
              const parsed = parseEarlyReason(r.reason);
              return (
                <Card
                  key={r.id}
                  className="p-4 space-y-3 border-amber-300 bg-amber-50/60"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{r.worker_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.date} · skickat {format(new Date(r.created_at), "HH:mm")}
                      </p>
                      {parsed.uncheckedCount !== null && (
                        <Badge variant="outline" className="border-amber-400 text-amber-800 bg-white">
                          {parsed.uncheckedCount} obockade {parsed.uncheckedCount === 1 ? "punkt" : "punkter"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border border-amber-200 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Medarbetarens motivering
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{parsed.text || "–"}</p>
                  </div>
                  <Textarea
                    placeholder="Anteckning (valfritt)"
                    value={adminNotes[r.id] || ""}
                    onChange={(e) => setAdminNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction.mutate({ id: r.id, action: "approved", request: r })}
                      disabled={handleAction.isPending}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Markera hanterad
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction.mutate({ id: r.id, action: "denied", request: r })}
                      disabled={handleAction.isPending}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" />
                      Avfärda
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Vanliga korrigeringar */}
      {showNormal && (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          Korrigeringsförfrågningar
          {normalPending.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {normalPending.length} väntande
            </Badge>
          )}
        </h2>

        {normalPending.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Check className="h-10 w-10 text-primary/40 mb-2" />
            <p className="font-medium text-muted-foreground">Inga väntande förfrågningar</p>
            <p className="text-sm text-muted-foreground">Alla rättelser är hanterade</p>
          </div>
        ) : (
          <div className="space-y-3">
            {normalPending.map((r: any) => (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-foreground">{r.worker_name}</p>
                    <p className="text-sm text-muted-foreground">Datum: {r.date}</p>
                    <p className="text-sm text-muted-foreground">
                      In: {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "–"} | Ut: {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "–"}
                    </p>
                    <p className="text-sm mt-1">Anledning: {r.reason}</p>
                  </div>
                </div>
                <Textarea
                  placeholder="Anteckning (valfritt)"
                  value={adminNotes[r.id] || ""}
                  onChange={(e) => setAdminNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction.mutate({ id: r.id, action: "approved", request: r })}
                    disabled={handleAction.isPending}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Godkänn
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction.mutate({ id: r.id, action: "denied", request: r })}
                    disabled={handleAction.isPending}
                    className="gap-1"
                  >
                    <X className="h-4 w-4" />
                    Neka
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}

      {filteredHandled.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-medium text-muted-foreground">Hanterade</h3>

          {/* Mobilkort */}
          <div className="md:hidden space-y-2">
            {filteredHandled.map((r: any) => {
              const early = isEarlyClockout(r);
              const typeBadge = early ? (
                <Badge variant="outline" className="border-amber-400 text-amber-800">
                  Tidig utstämpling
                </Badge>
              ) : (
                <Badge variant="outline">Korrigering</Badge>
              );
              return (
                <Card key={r.id} className="p-3 space-y-2 overflow-hidden">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground break-words min-w-0 flex-1">{r.worker_name}</p>
                    {r.status === "approved" ? (
                      <Badge className="bg-green-600 shrink-0">{early ? "Hanterad" : "Godkänd"}</Badge>
                    ) : (
                      <Badge variant="destructive" className="shrink-0">{early ? "Avfärdad" : "Nekad"}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{r.date}</span>
                    {typeBadge}
                  </div>
                  {r.admin_note && (
                    <p className="text-sm text-foreground break-words">{r.admin_note}</p>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Desktop-tabell */}
          <div className="hidden md:block rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbetare</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Anteckning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHandled.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.worker_name}</TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>
                      {isEarlyClockout(r) ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-800">
                          Tidig utstämpling
                        </Badge>
                      ) : (
                        <Badge variant="outline">Korrigering</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.status === "approved" ? (
                        <Badge className="bg-green-600">{isEarlyClockout(r) ? "Hanterad" : "Godkänd"}</Badge>
                      ) : (
                        <Badge variant="destructive">{isEarlyClockout(r) ? "Avfärdad" : "Nekad"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{r.admin_note || "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Cleanup confirmation */}
      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rensa gamla rättelser</AlertDialogTitle>
            <AlertDialogDescription>
              Detta tar bort alla rättelser äldre än 30 dagar (oavsett status). Antalet rättelser som kommer raderas: <strong>{oldCount} st</strong>. Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cleanupMutation.mutate();
              }}
              disabled={cleanupMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ta bort {oldCount} rättelser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimeCorrectionRequests;
