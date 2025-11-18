import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple password check (in production, use proper authentication)
    if (password === "campsite2024") {
      navigate("/admin/dashboard");
    } else {
      toast({
        title: "Incorrect password",
        variant: "destructive",
      });
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Lock className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Admin Access</h1>
          <p className="text-muted-foreground">Enter password to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 text-lg"
            autoFocus
          />
          
          <div className="space-y-3">
            <Button
              type="submit"
              size="lg"
              className="w-full text-lg"
            >
              Login
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full text-lg"
              onClick={() => navigate("/")}
            >
              Back
            </Button>
          </div>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Default password: campsite2024
        </p>
      </Card>
    </div>
  );
};

export default Admin;
