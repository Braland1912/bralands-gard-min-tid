import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, UserCircle2, Plus, Pencil, Trash2, MoveRight, Play, Square, ListChecks, Coins, StickyNote, MapPinPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEveningRoundActivityLog, type EveningRoundActivityLog } from "@/hooks/useEveningRoundActivityLog";
import { formatLocalDate } from "@/lib/date-format";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const shiftDate = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

type Filter = "alla" | "guest" | "place" | "summary" | "session";

const ICONS: Record<string, JSX.Element> = {
  "guest.create": <Plus className="h-3.5 w-3.5" />,
  "guest.update": <Pencil className="h-3.5 w-3.5" />,
  "guest.delete": <Trash2 className="h-3.5 w-3.5" />,
  "place.create": <MapPinPlus className="h-3.5 w-3.5" />,
  "place.rename": <MoveRight className="h-3.5 w-3.5" />,
  "place.delete": <Trash2 className="h-3.5 w-3.5" />,
  "summary.checklist": <ListChecks className="h-3.5 w-3.5" />,
  "summary.cash": <Coins className="h-3.5 w-3.5" />,
  "summary.notes": <StickyNote className="h-3.5 w-3.5" />,
  "summary.update": <Pencil className="h-3.5 w-3.5" />,
  "session.start": <Play className="h-3.5 w-3.5" />,
  "session.end": <Square className="h-3.5 w-3.5" />,
};

const ENTITY_LABELS: Record<string, string> = {
  guest: "Gäst",
  place: "Plats",
  summary: "Sammanställning",
  session: "Runda",
};

const ENTITY_BADGE: Record<string, string> = {
  guest: "bg-blue-50 text-blue-800 border-blue-200",
  place: "bg-emerald-50 text-emerald-800 border-emerald-200",
  summary: "bg-amber-50 text-amber-800 border-amber-200",
  session: "bg-purple-50 text-purple-800 border-purple-200",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

const AdminEveningRoundLogDialog = () => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(todayLocal());
  const [filter, setFilter] = useState<Filter>("alla");

  const { data: logs = [], isLoading } = useEveningRoundActivityLog(date, open);

  // Slå upp namn för worker_id där worker_name saknas
  const missingIds = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .filter((l) => !l.worker_name && l.worker_id)
            .map((l) => l.worker_id as string),
        ),
      ),
    [logs],
  );

  const { data: nameById = new Map<string, string>() } = useQuery({
    queryKey: ["evening-round-activity-worker-names", missingIds.join(",")],
    queryFn: async () => {
      if (missingIds.length === 0) return new Map<string, string>();
      const { data } = await supabase.from("workers").select("id, name").in("id", missingIds);
      return new Map((data ?? []).map((w: any) => [w.id as string, w.name as string]));
    },
    enabled: open && missingIds.length > 0,
  });

  const resolvedName = (l: EveningRoundActivityLog) =>
    l.worker_name || (l.worker_id ? nameById.get(l.worker_id) : null) || "Okänd";

  const filtered = useMemo(() => {
    if (filter === "alla") return logs;
    return logs.filter((l) => l.entity_type === filter);
  }, [logs, filter]);

  // Gruppera per timme för läsbarhet
  const grouped = useMemo(() => {
    const out: Array<{ hour: string; items: EveningRoundActivityLog[] }> = [];
    filtered.forEach((l) => {
      const hour = new Date(l.created_at).toLocaleTimeString("sv-SE", {
        hour: "2-digit",
        minute: undefined,
      });
      const last = out[out.length - 1];
      if (last && last.hour === hour) last.items.push(l);
      else out.push({ hour, items: [l] });
    });
    return out;
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">Aktivitetslogg</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aktivitetslogg – kvällsrundan</DialogTitle>
          <DialogDescription>
            Här ser du vem som gjorde vad i kvällsrundan, datum för datum.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="h-8 w-8 shrink-0 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center"
            aria-label="Föregående dag"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center gap-1.5 text-xs font-semibold capitalize"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{formatLocalDate(date, "long")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                weekStartsOn={1}
                selected={(() => {
                  const [y, m, d] = date.split("-").map(Number);
                  return new Date(y, m - 1, d);
                })()}
                onSelect={(d) => {
                  if (!d) return;
                  const yy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const dd = String(d.getDate()).padStart(2, "0");
                  setDate(`${yy}-${mm}-${dd}`);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setDate(todayLocal())}
            className="h-8 px-2.5 shrink-0 rounded-lg text-xs font-medium border border-border bg-card hover:bg-accent"
          >
            Idag
          </button>
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            className="h-8 w-8 shrink-0 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center"
            aria-label="Nästa dag"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="alla" className="flex-1 text-xs">
              Alla ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="guest" className="flex-1 text-xs">
              Gäster
            </TabsTrigger>
            <TabsTrigger value="place" className="flex-1 text-xs">
              Platser
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 text-xs">
              Sammanst.
            </TabsTrigger>
            <TabsTrigger value="session" className="flex-1 text-xs">
              Runda
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Inga händelser den här dagen.
            </div>
          ) : (
            <ul className="space-y-3 py-2">
              {grouped.map((group, gi) => (
                <li key={`${group.hour}-${gi}`} className="space-y-1.5">
                  <div className="sticky top-0 bg-background/95 backdrop-blur text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-1">
                    Kl. {group.hour}
                  </div>
                  {group.items.map((l) => {
                    const key = `${l.entity_type}.${l.action}`;
                    const icon = ICONS[key] ?? <Pencil className="h-3.5 w-3.5" />;
                    return (
                      <div
                        key={l.id}
                        className="flex items-start gap-2 rounded-xl border border-border bg-card p-2.5"
                      >
                        <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground text-sm flex items-center gap-1">
                              <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {resolvedName(l)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${ENTITY_BADGE[l.entity_type] ?? ""}`}
                            >
                              {ENTITY_LABELS[l.entity_type] ?? l.entity_type}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                              {formatTime(l.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mt-0.5 break-words">{l.summary}</p>
                        </div>
                      </div>
                    );
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminEveningRoundLogDialog;
