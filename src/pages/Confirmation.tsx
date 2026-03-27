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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-10 space-y-6 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-20 w-20 text-primary animate-in zoom-in duration-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {type === "in" ? "Instämplad!" : "Utstämplad!"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {name}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleString("sv-SE")}
          </p>
        </div>

        <Button
          onClick={() => navigate("/")}
          size="lg"
          className="w-full"
        >
          Tillbaka
        </Button>
      </Card>
    </div>
  );
};

export default Confirmation;
