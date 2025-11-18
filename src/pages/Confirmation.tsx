import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const Confirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get("type");
  const name = searchParams.get("name");

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 text-center shadow-lg">
        <div className="flex justify-center">
          <CheckCircle className="h-20 w-20 text-primary animate-in zoom-in duration-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {type === "in" ? "Clocked In!" : "Clocked Out!"}
          </h1>
          <p className="text-xl text-muted-foreground">
            {name}
          </p>
          <p className="text-lg text-muted-foreground">
            {new Date().toLocaleString()}
          </p>
        </div>

        <Button
          onClick={() => navigate("/")}
          size="lg"
          className="w-full text-lg"
        >
          Back to Main Screen
        </Button>
      </Card>
    </div>
  );
};

export default Confirmation;
