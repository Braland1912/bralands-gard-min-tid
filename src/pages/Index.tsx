import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Clock, LogIn, LogOut, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const handleClockIn = async () => {
    if (!selectedWorker) {
      toast({
        title: "Please select your name",
        variant: "destructive",
      });
      return;
    }

    const worker = workers.find(w => w.id === selectedWorker);
    if (!worker) return;

    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        worker_id: selectedWorker,
        worker_name: worker.name,
        clock_in: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error clocking in",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    navigate(`/confirmation?type=in&name=${encodeURIComponent(worker.name)}`);
  };

  const handleClockOut = async () => {
    if (!selectedWorker) {
      toast({
        title: "Please select your name",
        variant: "destructive",
      });
      return;
    }

    const worker = workers.find(w => w.id === selectedWorker);
    if (!worker) return;

    // Find the most recent clock-in entry without a clock-out
    const { data: recentEntry, error: fetchError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("worker_id", selectedWorker)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      toast({
        title: "Error",
        description: fetchError.message,
        variant: "destructive",
      });
      return;
    }

    if (!recentEntry) {
      toast({
        title: "No active clock-in found",
        description: "Please clock in first",
        variant: "destructive",
      });
      return;
    }

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", recentEntry.id);

    if (updateError) {
      toast({
        title: "Error clocking out",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    navigate(`/confirmation?type=out&name=${encodeURIComponent(worker.name)}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <Card className="w-full max-w-md p-8 space-y-8 shadow-lg">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Clock className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Campsite Time Clock</h1>
          <p className="text-muted-foreground">Select your name and clock in or out</p>
        </div>

        <div className="space-y-6">
          <Select value={selectedWorker} onValueChange={setSelectedWorker}>
            <SelectTrigger className="h-14 text-lg">
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent>
              {workers.map((worker) => (
                <SelectItem key={worker.id} value={worker.id} className="text-lg py-3">
                  {worker.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={handleClockIn}
              size="lg"
              className="h-24 text-xl font-semibold bg-primary hover:bg-primary/90"
              disabled={!selectedWorker}
            >
              <LogIn className="mr-2 h-6 w-6" />
              Clock In
            </Button>
            <Button
              onClick={handleClockOut}
              size="lg"
              variant="secondary"
              className="h-24 text-xl font-semibold"
              disabled={!selectedWorker}
            >
              <LogOut className="mr-2 h-6 w-6" />
              Clock Out
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Index;
