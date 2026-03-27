import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, X } from "lucide-react";

const TimeCorrectionRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

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

  const pendingCount = requests.filter((r: any) => r.status === "pending").length;

  const handleAction = useMutation({
    mutationFn: async ({ id, action, request }: { id: string; action: "approved" | "denied"; request: any }) => {
      const note = adminNotes[id] || null;

      // Update request status
      const { error: updateError } = await supabase
        .from("time_correction_requests")
        .update({ status: action, admin_note: note })
        .eq("id", id);
      if (updateError) throw updateError;

      // If approved, upsert into time_entries
      if (action === "approved") {
        const { error: insertError } = await supabase.from("time_entries").insert({
          worker_id: request.worker_id,
          worker_name: request.worker_name,
          clock_in: request.clock_in,
          clock_out: request.clock_out,
        });
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["correction-requests"] });
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      toast({
        title: action === "approved" ? "Godkänd" : "Nekad",
        description: action === "approved"
          ? "Tidposten har skapats."
          : "Förfrågan har nekats.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Fel", description: err.message, variant: "destructive" });
    },
  });

  const pendingRequests = requests.filter((r: any) => r.status === "pending");
  const handledRequests = requests.filter((r: any) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
        Korrigeringsförfrågningar
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {pendingCount} väntande
          </Badge>
        )}
      </h2>

      {pendingRequests.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Check className="h-10 w-10 text-primary/40 mb-2" />
          <p className="font-medium text-muted-foreground">Inga väntande förfrågningar</p>
          <p className="text-sm text-muted-foreground">Alla rättelser är hanterade 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRequests.map((r: any) => (
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

      {handledRequests.length > 0 && (
        <div className="space-y-2 pt-4">
          <h3 className="text-sm font-medium text-muted-foreground">Hanterade</h3>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medarbetare</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Anteckning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {handledRequests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.worker_name}</TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>
                      {r.status === "approved" ? (
                        <Badge className="bg-green-600">Godkänd</Badge>
                      ) : (
                        <Badge variant="destructive">Nekad</Badge>
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
    </div>
  );
};

export default TimeCorrectionRequests;
