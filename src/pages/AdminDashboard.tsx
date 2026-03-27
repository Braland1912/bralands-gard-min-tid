import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Calendar } from "lucide-react";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import InvitationManager from "@/components/InvitationManager";
import TeamMembers from "@/components/TeamMembers";
import PendingMembers from "@/components/PendingMembers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [selectedWorker, setSelectedWorker] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
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
    queryKey: ["time_entries", selectedWorker, selectedDate],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedWorker !== "all") {
        query = query.eq("worker_id", selectedWorker);
      }

      if (selectedDate) {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
          .gte("created_at", startOfDay.toISOString())
          .lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const exportToCSV = () => {
    const headers = ["Worker Name", "Clock In", "Clock Out", "Date"];
    const rows = entries.map(entry => [
      entry.worker_name,
      entry.clock_in ? format(new Date(entry.clock_in), "HH:mm:ss") : "N/A",
      entry.clock_out ? format(new Date(entry.clock_out), "HH:mm:ss") : "Not clocked out",
      entry.clock_in ? format(new Date(entry.clock_in), "yyyy-MM-dd") : "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-entries-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const calculateHours = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return null;
    
    const inTime = new Date(clockIn);
    const outTime = new Date(clockOut);
    const hours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
    return hours;
  };

  const workerSummary = useMemo(() => {
    const summary = new Map<string, { name: string; totalHours: number; entries: number }>();
    
    entries.forEach((entry) => {
      const hours = calculateHours(entry.clock_in, entry.clock_out);
      const existing = summary.get(entry.worker_name) || { name: entry.worker_name, totalHours: 0, entries: 0 };
      
      summary.set(entry.worker_name, {
        name: entry.worker_name,
        totalHours: existing.totalHours + (hours || 0),
        entries: existing.entries + 1,
      });
    });
    
    return Array.from(summary.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [entries]);

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <ChangePasswordDialog />
            <Button onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <InvitationManager />

        <PendingMembers />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Filter by Worker</label>
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger>
                <SelectValue placeholder="All workers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Filter by Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {workerSummary.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Sammanfattning per medarbetare</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workerSummary.map((worker) => (
                <Card key={worker.name} className="p-4 space-y-2">
                  <h3 className="font-semibold text-lg text-foreground">{worker.name}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Totalt antal pass:</span>
                      <span className="font-medium">{worker.entries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Totala timmar:</span>
                      <span className="font-medium">{worker.totalHours.toFixed(2)} h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Genomsnitt/pass:</span>
                      <span className="font-medium">{(worker.totalHours / worker.entries).toFixed(2)} h</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No entries found
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.worker_name}</TableCell>
                    <TableCell>
                      {entry.clock_in ? format(new Date(entry.clock_in), "MMM dd, yyyy") : "N/A"}
                    </TableCell>
                    <TableCell>
                      {entry.clock_in ? format(new Date(entry.clock_in), "HH:mm:ss") : "N/A"}
                    </TableCell>
                    <TableCell>
                      {entry.clock_out ? format(new Date(entry.clock_out), "HH:mm:ss") : (
                        <span className="text-primary font-medium">Active</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const hours = calculateHours(entry.clock_in, entry.clock_out);
                        return hours ? `${hours.toFixed(2)} h` : "Pågående";
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;
