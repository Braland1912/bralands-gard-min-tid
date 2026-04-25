import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

const Confirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get("type");
  const name = searchParams.get("name");
  const ts = searchParams.get("ts");
  const tsDate = ts ? new Date(ts) : new Date();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const timeStr = tsDate.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = tsDate.toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-16 pb-8 safe-area-inset">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 w-full max-w-md mx-auto">
        <CheckCircle
          className="h-32 w-32 text-primary animate-in zoom-in duration-500"
          strokeWidth={1.5}
        />

        <div className="space-y-3 w-full">
          <h1 className="text-5xl font-bold text-foreground tracking-tight leading-none animate-in fade-in slide-in-from-bottom-2 duration-500">
            {type === "in" ? "Instämplad" : "Utstämplad"}
          </h1>
          {name && (
            <p className="text-2xl font-medium text-foreground animate-in fade-in duration-700">
              {name}
            </p>
          )}
        </div>

        <div className="w-full space-y-1 animate-in fade-in duration-700">
          <p className="text-6xl font-semibold text-primary tabular-nums tracking-tight">
            {timeStr}
          </p>
          <p className="text-base text-muted-foreground capitalize">{dateStr}</p>
        </div>
      </div>

      <Button
        onClick={() => navigate("/")}
        size="lg"
        className="w-full h-16 text-lg font-semibold"
      >
        Klar
      </Button>
    </div>
  );
};

export default Confirmation;
