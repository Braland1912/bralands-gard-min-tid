import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useWorker } from "@/hooks/useWorker";

const Admin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { data: worker } = useWorker(user?.id);

  // Redirect logged-in users appropriately
  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (user && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    } else if (user && !isAdmin) {
      // Non-admin user trying to access /admin → redirect home
      navigate("/", { replace: true });
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      toast({
        title: "Inloggning misslyckades",
        description: "Fel e-post eller lösenord.",
        variant: "destructive",
      });
      return;
    }

    // Check if the logged-in user is admin
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (data) {
        navigate("/admin/dashboard");
      } else {
        // Not an admin - sign out and show error
        await supabase.auth.signOut();
        toast({
          title: "Åtkomst nekad",
          description: "Du har inte administratörsrättigheter.",
          variant: "destructive",
        });
      }
    }
    setLoading(false);
  };

  // Don't show login form while checking auth
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  // If user is logged in, the useEffect will handle redirect
  if (user) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-10 space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Adminåtkomst</h1>
            <p className="text-muted-foreground">Logga in för att fortsätta</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="E-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12"
            autoFocus
            required
          />
          <Input
            type="password"
            placeholder="Lösenord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12"
            required
          />

          <div className="space-y-3">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Loggar in..." : "Logga in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full text-muted-foreground"
              onClick={() => navigate("/")}
            >
              Tillbaka
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Glömt lösenordet? Kontakta administratören.
          </p>
        </form>
      </Card>
    </div>
  );
};

export default Admin;
