import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Download, Calendar, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

const AdminTimeLog = () => {
  const [selectedWorker, setSelectedWorker] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["time_entries", selectedWorker, selectedDate],
    queryFn: async () => {
      let query = supabase.from("time_entries").select("*").order("clock_in", { ascending: false });
      if (selectedWorker !== "all") query = query.eq("worker_id", selectedWorker);
      if (selectedDate) {
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        query = query.gte("clock_in", start.toISOString()).lte("clock_in", end.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Tidslogg</h2>
        <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select value={selectedWorker} onValueChange={setSelectedWorker}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Alla medarbetare" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla medarbetare</SelectItem>
            {workers.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      </div>

      {groupedByDay.length === 0 ? (
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
                    <Card key={entry.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{entry.worker_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.clock_in ? format(new Date(entry.clock_in), "HH:mm") : "–"} — {entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : <span className="text-primary font-medium">Aktiv</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        {hours !== null ? (
                          <p className="font-semibold text-foreground">{hours.toFixed(2)} h</p>
                        ) : (
                          <p className="text-sm text-primary font-medium">Pågående</p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTimeLog;
