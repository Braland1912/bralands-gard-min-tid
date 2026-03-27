import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogIn, LogOut, Settings, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  const { data: worker } = useQuery({
    queryKey: ["my-worker", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  if (!user) return null;

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
          {worker ? (
            <p className="text-lg text-muted-foreground">
              Hej, <span className="font-semibold text-foreground">{worker.name}</span>! 👋
            </p>
          ) : (
            <p className="text-muted-foreground">
              Ditt konto är inte kopplat till en medarbetare. Kontakta admin.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Stämpla in när du börjar jobba. Glöm inte stämpla ut när du är klar eller tar rast.
          </p>
        </div>

        {worker && (
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
        )}
      </Card>
    </div>
  );
};

export default Index;
