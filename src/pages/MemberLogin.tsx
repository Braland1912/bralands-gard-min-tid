import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MemberLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Ange e-post", description: "Fyll i din e-postadress.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Fel", description: error.message, variant: "destructive" });
    } else {
      setResetSent(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast({ title: "Inloggning misslyckades", description: "Fel e-post eller lösenord.", variant: "destructive" });
      return;
    }

    // Check if user is approved
    const status = data.user?.user_metadata?.status;
    if (status === "pending") {
      await supabase.auth.signOut();
      toast({ title: "Väntar på godkännande", description: "Din ansökan väntar fortfarande på godkännande av admin.", variant: "destructive" });
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <LogIn className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{forgotMode ? "Återställ lösenord" : "Logga in"}</h1>
          <p className="text-muted-foreground">{forgotMode ? "Ange din e-post för att få en återställningslänk" : "Logga in med ditt konto"}</p>
        </div>

        {forgotMode ? (
          resetSent ? (
            <div className="space-y-4 text-center">
              <p className="text-foreground">Ett e-postmeddelande med en återställningslänk har skickats till <strong>{email}</strong>.</p>
              <p className="text-sm text-muted-foreground">Kolla din inkorg (och skräpposten).</p>
              <Button variant="outline" size="lg" className="w-full text-lg" onClick={() => { setForgotMode(false); setResetSent(false); }}>
                Tillbaka till inloggning
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <Input
                type="email"
                placeholder="E-postadress"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 text-lg"
                required
              />
              <Button type="submit" size="lg" className="w-full text-lg" disabled={loading}>
                {loading ? "Skickar..." : "Skicka återställningslänk"}
              </Button>
              <Button type="button" variant="outline" size="lg" className="w-full text-lg" onClick={() => setForgotMode(false)}>
                Tillbaka till inloggning
              </Button>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="E-postadress"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 text-lg"
              required
            />
            <Input
              type="password"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 text-lg"
              required
            />
            <Button type="submit" size="lg" className="w-full text-lg" disabled={loading}>
              {loading ? "Loggar in..." : "Logga in"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setForgotMode(true)}>
              Glömt lösenord?
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full text-lg" onClick={() => navigate("/")}>
              Tillbaka
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default MemberLogin;
