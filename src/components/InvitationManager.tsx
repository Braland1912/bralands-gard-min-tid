import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const InvitationManager = () => {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: invitations = [], refetch } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const generateInvite = async () => {
    setGenerating(true);
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase.from("invitations").insert({
      token,
      expires_at: expiresAt.toISOString(),
    });

    setGenerating(false);
    if (error) {
      toast.error("Kunde inte skapa inbjudningslänk");
      return;
    }

    toast.success("Inbjudningslänk skapad!");
    refetch();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    toast.success("Länk kopierad!");
    setTimeout(() => setCopied(null), 2000);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Inbjudningslänkar</h2>
        <Button onClick={generateInvite} disabled={generating} className="gap-2">
          <Link2 className="h-4 w-4" />
          {generating ? "Skapar..." : "Generera inbjudningslänk"}
        </Button>
      </div>

      {invitations.length > 0 && (
        <div className="space-y-2">
          {invitations.map((inv) => (
            <Card key={inv.id} className="p-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  readOnly
                  value={`${window.location.origin}/invite/${inv.token}`}
                  className="text-sm bg-muted"
                />
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>
                    Giltig till: {format(new Date(inv.expires_at), "yyyy-MM-dd HH:mm")}
                  </span>
                  <span>Använd: {inv.used_count} gånger</span>
                  {isExpired(inv.expires_at) && (
                    <span className="text-destructive font-medium">Utgången</span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyLink(inv.token)}
                disabled={isExpired(inv.expires_at)}
              >
                {copied === inv.token ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvitationManager;
