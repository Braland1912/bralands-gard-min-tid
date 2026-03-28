import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogIn, LogOut, FileText, Clock, Check, Loader2, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import logo from "@/assets/logo-braland.svg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { useAdmin } from "@/hooks/useAdmin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

type ClockState = "idle" | "loading" | "confirmed";

const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="text-center space-y-0.5">
      <p className="text-2xl font-semibold text-foreground tabular-nums tracking-tight">
        {now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-xs text-muted-foreground capitalize">
        {now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
      </p>
    </div>
  );
};

const ActiveTimer = ({ since }: { since: string }) => {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      const ms = Date.now() - new Date(since).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setElapsed(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [since]);
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-1">
      <p className="text-xs text-primary font-medium uppercase tracking-wide">Instämplad sedan {new Date(since).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</p>
      <p className="text-3xl font-semibold text-primary tabular-nums">{elapsed}</p>
    </div>
  );
};

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: worker, isLoading: workerLoading } = useWorker(user?.id);
  const { isAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const [clockInState, setClockInState] = useState<ClockState>("idle");
  const [clockOutState, setClockOutState] = useState<ClockState>("idle");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Redirect admin
  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  // Active clock-in query
  const { data: activeEntry, isLoading: activeLoading } = useQuery({
    queryKey: ["active-entry", worker?.id],
    queryFn: async () => {
      if (!worker) return null;
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("worker_id", worker.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!worker,
    refetchInterval: 30000,
  });

  // Today's completed hours
  const { data: todayHours = 0 } = useQuery({
    queryKey: ["my-today-hours", worker?.id],
    queryFn: async () => {
      if (!worker) return 0;
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const { data, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .eq("worker_id", worker.id)
        .gte("clock_in", startOfDay)
        .not("clock_out", "is", null);
      if (error) throw error;
      return (data || []).reduce((sum, e) => {
        return sum + (new Date(e.clock_out!).getTime() - new Date(e.clock_in!).getTime()) / 3600000;
      }, 0);
    },
    enabled: !!worker,
  });

  // Check for forgotten clock-out (previous day)
  const forgottenEntry = activeEntry && activeEntry.clock_in
    ? new Date(activeEntry.clock_in).toDateString() !== new Date().toDateString()
      ? activeEntry
      : null
    : null;

  const handleClockIn = useCallback(async () => {
    if (!worker || clockInState !== "idle" || !isOnline) return;
    if (activeEntry) {
      toast({ title: "Du ar redan instamplad", description: "Du har redan en aktiv stampling. Stampla ut forst.", variant: "destructive" });
      return;
    }

    setClockInState("loading");
    try {
      const { error } = await supabase
        .from("time_entries")
        .insert({
          worker_id: worker.id,
          worker_name: worker.name,
          clock_in: new Date().toISOString(),
        });
      if (error) throw error;

      setClockInState("confirmed");
      await queryClient.invalidateQueries({ queryKey: ["active-entry"] });
      await queryClient.invalidateQueries({ queryKey: ["my-today-hours"] });
      await queryClient.invalidateQueries({ queryKey: ["my-today-entries"] });

      setTimeout(() => setClockInState("idle"), 1500);
    } catch (err: any) {
      console.error("Clock in failed:", err);
      toast({ title: "Stämpling misslyckades", description: err.message || "Försök igen.", variant: "destructive" });
      setClockInState("idle");
    }
  }, [worker, clockInState, isOnline, activeEntry, toast, queryClient]);

  const handleClockOut = useCallback(async () => {
    if (!worker || clockOutState !== "idle" || !isOnline) return;
    if (!activeEntry) {
      toast({ title: "Ingen aktiv stämpling", description: "Du måste stämpla in först.", variant: "destructive" });
      return;
    }

    setClockOutState("loading");
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", activeEntry.id);
      if (error) throw error;

      setClockOutState("confirmed");
      await queryClient.invalidateQueries({ queryKey: ["active-entry"] });
      await queryClient.invalidateQueries({ queryKey: ["my-today-hours"] });
      await queryClient.invalidateQueries({ queryKey: ["my-today-entries"] });

      setTimeout(() => setClockOutState("idle"), 1500);
    } catch (err: any) {
      console.error("Clock out failed:", err);
      toast({ title: "Utstämpling misslyckades", description: err.message || "Försök igen.", variant: "destructive" });
      setClockOutState("idle");
    }
  }, [worker, clockOutState, isOnline, activeEntry, toast, queryClient]);

  const handleForgottenCorrection = () => {
    navigate("/my-time");
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
              <p className="text-muted-foreground">Logga in för att stämpla din tid</p>
            </div>
          </div>
          <Button onClick={() => navigate("/login")} size="lg" className="w-full h-14 text-base font-semibold gap-2">
            <LogIn className="h-5 w-5" />
            Logga in
          </Button>
        </Card>
      </div>
    );
  }

  const renderButtonContent = (state: ClockState, label: string, icon: React.ReactNode) => {
    if (state === "loading") return <Loader2 className="h-6 w-6 animate-spin" />;
    if (state === "confirmed") return <Check className="h-8 w-8 text-emerald-500" />;
    return <>{icon}<span>{label}</span></>;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8 space-y-6">
        {/* Logo & greeting */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <img src={logo} alt="Brålands Gård" className="h-14 sm:h-16 w-auto max-w-[160px] object-contain" />
          </div>
          {workerLoading || activeLoading ? (
            <Skeleton className="h-6 w-48 mx-auto" />
          ) : worker ? (
            <div className="space-y-1">
              <p className="text-lg text-muted-foreground">
                Hej, <span className="font-semibold text-foreground">{worker.name}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Laddar kontoinformation...</p>
          )}
        </div>

        {/* Live clock */}
        <LiveClock />

        {/* Offline warning */}
        {!isOnline && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
            <WifiOff className="h-4 w-4 shrink-0" />
            Ingen internetanslutning — stämpling är inte möjlig just nu.
          </div>
        )}

        {worker && (
          <div className="space-y-4">
            {/* Forgotten clock-out warning */}
            {forgottenEntry && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Glömd utstämpling
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Du har en öppen stämpling från{" "}
                      {new Date(forgottenEntry.clock_in!).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}.
                      Skicka en rättelsebegäran.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-amber-800 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/50"
                  onClick={handleForgottenCorrection}
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Rapportera rättelse
                </Button>
              </div>
            )}

            {/* Active timer */}
            {activeEntry && !forgottenEntry && (
              <ActiveTimer since={activeEntry.clock_in!} />
            )}

            {/* Today's summary */}
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wide">Idag totalt</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {(todayHours + (activeEntry && !forgottenEntry && activeEntry.clock_in
                  ? (Date.now() - new Date(activeEntry.clock_in).getTime()) / 3600000
                  : 0
                )).toFixed(1)} h
              </p>
            </div>

            {/* Clock in/out buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleClockIn}
                size="lg"
                disabled={clockInState !== "idle" || !!activeEntry || !isOnline}
                className={`h-24 text-lg font-semibold gap-2 transition-all duration-200 ${
                  clockInState === "confirmed" ? "bg-emerald-500 hover:bg-emerald-500" : ""
                }`}
              >
                {renderButtonContent(clockInState, "Stämpla in", <LogIn className="h-6 w-6" />)}
              </Button>
              <Button
                onClick={handleClockOut}
                size="lg"
                variant="outline"
                disabled={clockOutState !== "idle" || !activeEntry || !!forgottenEntry || !isOnline}
                className={`h-24 text-lg font-semibold gap-2 transition-all duration-200 ${
                  clockOutState === "confirmed" ? "border-emerald-500 text-emerald-500" : ""
                }`}
              >
                {renderButtonContent(clockOutState, "Stämpla ut", <LogOut className="h-6 w-6" />)}
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
