import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogIn, LogOut, Settings, Power, FileText } from "lucide-react";
import logo from "@/assets/logo-braland.svg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorker } from "@/hooks/useWorker";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: worker, isLoading: workerLoading } = useWorker(user?.id);

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

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  // Welcome screen for unauthenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-8 shadow-lg text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <img src={logo} alt="Brålands Gård" className="h-20 sm:h-24 w-auto max-w-[220px] object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Brålands Gård</h1>
            <p className="text-muted-foreground text-lg">
              Logga in för att stämpla din tid
            </p>
          </div>
          <Button
            onClick={() => navigate("/login")}
            size="lg"
            className="w-full h-14 text-lg font-semibold gap-2"
          >
            <LogIn className="h-5 w-5" />
            Logga in
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <Power className="h-4 w-4 mr-1" />
          Logga ut
        </Button>
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
          <h1 className="text-3xl font-bold text-foreground">Brålands Gård - Min Tid</h1>
          {workerLoading ? (
            <Skeleton className="h-6 w-48 mx-auto" />
          ) : worker ? (
            <p className="text-lg text-muted-foreground">
              Hej, <span className="font-semibold text-foreground">{worker.name}</span>! 👋
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-primary">👋 Inloggad som admin</p>
              <p className="text-sm text-muted-foreground">
                Gå till <button onClick={() => navigate("/admin/dashboard")} className="underline text-primary hover:text-primary/80">admin dashboard</button> för att hantera teamet.
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Stämpla in när du börjar jobba. Glöm inte stämpla ut när du är klar eller tar rast.
          </p>
        </div>

        {worker && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handleClockIn}
                size="lg"
                className="h-24 text-xl font-semibold bg-primary hover:bg-primary/90"
              >
                <LogIn className="mr-2 h-6 w-6" />
                Stämpla in
              </Button>
              <Button
                onClick={handleClockOut}
                size="lg"
                variant="secondary"
                className="h-24 text-xl font-semibold"
              >
                <LogOut className="mr-2 h-6 w-6" />
                Stämpla ut
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
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
