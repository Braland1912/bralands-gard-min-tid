import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { CalendarPlus, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const generateToken = () =>
  (crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""));

const buildWebcalUrl = (token: string) => {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const webcalBase = base.replace(/^https?:\/\//, "webcal://");
  return `${webcalBase}/functions/v1/schedule-ics?token=${token}`;
};

const buildHttpsUrl = (token: string) => {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/schedule-ics?token=${token}`;
};

const CalendarSyncCard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("calendar_feed_tokens")
        .select("token")
        .eq("revoked", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (!error && data?.token) setToken(data.token);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const createToken = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const newToken = generateToken();
      const { error } = await supabase
        .from("calendar_feed_tokens")
        .insert({ token: newToken, created_by: user?.id ?? null, label: "Schema" });
      if (error) throw error;
      setToken(newToken);
      toast.success("Kalenderlänk skapad");
    } catch (e: any) {
      toast.error("Kunde inte skapa kalenderlänk", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };


  return (
    <Card className="bg-card rounded-xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Synka till kalender</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prenumerera på hela schemat i iPhone-kalendern eller WeekCal — uppdateras automatiskt.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
        </div>
      ) : !token ? (
        <Button onClick={createToken} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Skapa kalenderlänk
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tryck <span className="font-medium text-foreground">Prenumerera i kalendern</span> och bekräfta i rutan som dyker upp — schemat hamnar i din kalender och i WeekCal.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={buildWebcalUrl(token)}
              className={buttonVariants({ variant: "default" }) + " gap-2"}
            >
              <CalendarPlus className="h-4 w-4" />
              Prenumerera i kalendern
            </a>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(buildWebcalUrl(token))
                  .then(() => toast.success("Länk kopierad!"))
                  .catch(() => toast.error("Kunde inte kopiera"));
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Kopiera länk
            </Button>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Visa länk (https)</summary>
            <code className="block mt-2 p-2 bg-muted rounded-md break-all">{buildHttpsUrl(token)}</code>
          </details>
        </div>
      )}
    </Card>
  );
};

export default CalendarSyncCard;
