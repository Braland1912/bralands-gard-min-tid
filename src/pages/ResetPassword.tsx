import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Fel", description: "Lösenordet måste vara minst 6 tecken.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Fel", description: "Lösenorden matchar inte.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: "Fel", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lösenord uppdaterat", description: "Du kan nu logga in med ditt nya lösenord." });
      await supabase.auth.signOut();
      navigate("/login");
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-4 shadow-lg text-center">
          <KeyRound className="h-12 w-12 text-primary mx-auto" />
          <p className="text-muted-foreground">Verifierar din återställningslänk...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <KeyRound className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold text-foreground">Nytt lösenord</h1>
          <p className="text-muted-foreground">Ange ditt nya lösenord nedan</p>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <Input
            type="password"
            placeholder="Nytt lösenord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 text-lg"
            required
          />
          <Input
            type="password"
            placeholder="Bekräfta lösenord"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-14 text-lg"
            required
          />
          <Button type="submit" size="lg" className="w-full text-lg" disabled={loading}>
            {loading ? "Sparar..." : "Uppdatera lösenord"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
