import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogIn, LogOut, FileText, Clock } from "lucide-react";
import logo from "@/assets/logo-braland.svg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: worker, isLoading: workerLoading } = useWorker(user?.id);
  const { isAdmin } = useAdmin();
  const [welcomeShown, setWelcomeShown] = useState(false);

  // Fetch today's time entries for this worker
  const { data: todayEntries = [] } = useQuery({
    queryKey: ["my-today-entries", worker?.id],
    queryFn: async () => {
      if (!worker) return [];
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .eq("worker_id", worker.id)
        .gte("clock_in", startOfDay)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!worker,
    refetchInterval: 30000, // refresh every 30s for live feel
  });

  const todayStats = (() => {
    let totalMs = 0;
    let activeStart: string | null = null;
    for (const e of todayEntries) {
      if (e.clock_in && e.clock_out) {
        totalMs += new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
      } else if (e.clock_in && !e.clock_out) {
        activeStart = e.clock_in;
        totalMs += Date.now() - new Date(e.clock_in).getTime();
      }
    }
    const totalH = totalMs / 3600000;
    return { totalH, activeStart };
  })();

  // If admin is logged in, redirect to admin dashboard
  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (worker && !welcomeShown) {
      const shown = sessionStorage.getItem("welcome_shown");
      if (!shown) {
        sessionStorage.setItem("welcome_shown", "true");
        toast({
          title: `Välkommen, ${worker.name}! 🎉`,
          description: "Ditt konto har blivit godkänt. Du kan nu stämpla in och ut.",
        });
        setWelcomeShown(true);
      }
    }
  }, [worker, welcomeShown, toast]);

  const handleClockIn = async () => {
    if (!worker) return;
    const { error } = await supabase
      .from("time_entries")
      .insert({
        worker_id: worker.id,
        worker_name: worker.name,
        clock_in: new Date().toISOString(),
      });

    if (error) {
      toast({ title: "Fel vid instämpling", description: error.message, variant: "destructive" });
      return;
    }
    navigate(`/confirmation?type=in&name=${encodeURIComponent(worker.name)}`);
  };

  const handleClockOut = async () => {
    if (!worker) return;
    const { data: recentEntry, error: fetchError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("worker_id", worker.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      toast({ title: "Fel", description: fetchError.message, variant: "destructive" });
      return;
    }
    if (!recentEntry) {
      toast({ title: "Ingen aktiv instämpling", description: "Stämpla in först", variant: "destructive" });
      return;
    }

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", recentEntry.id);

    if (updateError) {
      toast({ title: "Fel vid utstämpling", description: updateError.message, variant: "destructive" });
      return;
    }
    navigate(`/confirmation?type=out&name=${encodeURIComponent(worker.name)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-sm p-10 space-y-10 text-center">
          <div className="space-y-6">
            <div className="flex justify-center">
              <img src={logo} alt="Brålands Gård" className="h-20 sm:h-24 w-auto max-w-[200px] object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Brålands Gård</h1>
              <p className="text-muted-foreground">
                Logga in för att stämpla din tid
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/login")}
            size="lg"
            className="w-full h-14 text-base font-semibold gap-2"
          >
            <LogIn className="h-5 w-5" />
            Logga in
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-sm p-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Brålands Gård" className="h-16 sm:h-20 w-auto max-w-[180px] object-contain" />
          </div>
          {workerLoading ? (
            <Skeleton className="h-6 w-48 mx-auto" />
          ) : worker ? (
            <div className="space-y-1">
              <p className="text-lg text-muted-foreground">
                Hej, <span className="font-semibold text-foreground">{worker.name}</span> 👋
              </p>
              <p className="text-sm text-muted-foreground">
                Stämpla in när du börjar. Glöm inte stämpla ut.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Laddar kontoinformation...
              </p>
            </div>
          )}
        </div>

        {worker && (
          <div className="space-y-4">
            {/* Today's hours summary */}
            <div className="bg-muted/50 rounded-xl p-4 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Idag</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">
                {todayStats.totalH.toFixed(1)} h
              </p>
              {todayStats.activeStart && (
                <p className="text-xs text-primary font-medium">
                  ● Aktiv sedan {new Date(todayStats.activeStart).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleClockIn}
                size="lg"
                className="h-24 text-lg font-semibold"
              >
                <LogIn className="mr-2 h-6 w-6" />
                Stämpla in
              </Button>
              <Button
                onClick={handleClockOut}
                size="lg"
                variant="outline"
                className="h-24 text-lg font-semibold"
              >
                <LogOut className="mr-2 h-6 w-6" />
                Stämpla ut
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate("/my-time")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Min tid & korrigeringar
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Index;
