import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Admin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Inloggning misslyckades",
        description: "Fel e-post eller lösenord.",
        variant: "destructive",
      });
    } else {
      navigate("/admin/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Lock className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Adminåtkomst</h1>
          <p className="text-muted-foreground">Logga in för att fortsätta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="E-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 text-lg"
            autoFocus
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

          <div className="space-y-3">
            <Button
              type="submit"
              size="lg"
              className="w-full text-lg"
              disabled={loading}
            >
              {loading ? "Loggar in..." : "Logga in"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full text-lg"
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
