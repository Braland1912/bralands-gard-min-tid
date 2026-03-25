import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const PendingMembers = () => {
  const { data: pendingMembers = [], refetch } = useQuery({
    queryKey: ["pending_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_members")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleAction = async (memberId: string, action: "approve" | "deny") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Du måste vara inloggad");
      return;
    }

    const { data, error } = await supabase.functions.invoke("approve-member", {
      body: { memberId, action },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Något gick fel");
      return;
    }

    toast.success(action === "approve" ? "Medlem godkänd!" : "Medlem nekad");
    refetch();
  };

  if (pendingMembers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserCheck className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">
          Väntande medlemmar ({pendingMembers.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingMembers.map((member) => (
          <Card key={member.id} className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-lg text-foreground">
                {member.first_name} {member.last_name}
              </h3>
              <div className="text-sm text-muted-foreground space-y-1 mt-1">
                <p>📧 {member.email}</p>
                <p>📱 {member.phone}</p>
                <p>📅 Ansökt: {format(new Date(member.created_at), "yyyy-MM-dd HH:mm")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleAction(member.id, "approve")}
                className="flex-1 gap-2"
                size="sm"
              >
                <Check className="h-4 w-4" />
                Godkänn
              </Button>
              <Button
                onClick={() => handleAction(member.id, "deny")}
                variant="destructive"
                className="flex-1 gap-2"
                size="sm"
              >
                <X className="h-4 w-4" />
                Neka
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PendingMembers;
