import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { formatLocalDate, formatLocalTime } from "@/lib/date-format";

const Confirmation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get("type");
  const name = searchParams.get("name");
  const ts = searchParams.get("ts");
  const tsDate = ts ? new Date(ts) : new Date();
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          navigate("/");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  const timeStr = formatLocalTime(tsDate);
  const dateStr = formatLocalDate(tsDate, "long");

  return (
    <div
      className="min-h-screen bg-background flex flex-col px-6 pt-16 pb-8 safe-area-inset cursor-pointer"
      onClick={() => navigate("/")}
    >
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

      <div className="text-center animate-in fade-in duration-1000">
        <p className="text-sm text-muted-foreground">
          Skickar vidare om {secondsLeft} sekund{secondsLeft !== 1 ? "er" : ""}…
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Tryck var som helst för att gå vidare direkt
        </p>
      </div>
    </div>
  );
};

export default Confirmation;
