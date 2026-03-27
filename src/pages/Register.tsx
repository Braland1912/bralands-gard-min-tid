import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { UserPlus, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password.length < 6) {
      toast({ title: "Lösenordet måste vara minst 6 tecken", variant: "destructive" });
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast({ title: "Lösenorden matchar inte", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.functions.invoke("register-member", {
      body: {
        token,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      },
    });

    setLoading(false);

    if (error || data?.error) {
      toast({
        title: "Fel vid registrering",
        description: data?.error || error?.message || "Något gick fel.",
        variant: "destructive",
      });
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center shadow-lg">
          <div className="flex justify-center">
            <CheckCircle className="h-20 w-20 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Välkommen!</h1>
          <p className="text-muted-foreground">
            Ditt konto är klart. Du kan nu logga in och börja rapportera tid.
          </p>
          <Button onClick={() => window.location.href = "/login"} className="w-full">
            Gå till inloggning
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <UserPlus className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Registrera dig</h1>
          <p className="text-muted-foreground">
            Fyll i dina uppgifter för att gå med i teamet
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Förnamn"
              value={form.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              required
            />
            <Input
              placeholder="Efternamn"
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              required
            />
          </div>
          <Input
            type="email"
            placeholder="E-postadress"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            required
          />
          <Input
            type="tel"
            placeholder="Telefonnummer"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Lösenord (minst 6 tecken)"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Bekräfta lösenord"
            value={form.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Skapar konto..." : "Skapa konto"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Register;
