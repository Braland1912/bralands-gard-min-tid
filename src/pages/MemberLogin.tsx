import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-braland.svg";
import { useToast } from "@/hooks/use-toast";

const MemberLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast({ title: "Inloggningen misslyckades", description: "Kontrollera att e-post och losenord ar ratt och forsok igen.", variant: "destructive" });
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-10 space-y-8">
        <div className="text-center space-y-4">
          <Link to="/" className="flex justify-center">
            <img src={logo} alt="Brålands Gård" className="h-16 sm:h-20 w-auto max-w-[180px] object-contain" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Logga in</h1>
            <p className="text-muted-foreground">Logga in med ditt konto</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="E-postadress"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12"
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
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Loggar in..." : "Logga in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Glomt losenordet? Kontakta din arbetsledare.
          </p>
          <Button type="button" variant="ghost" size="lg" className="w-full text-muted-foreground" onClick={() => navigate("/")}>
            Tillbaka
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default MemberLogin;
