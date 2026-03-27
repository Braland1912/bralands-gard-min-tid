import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Users, KeyRound, DollarSign, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const TeamMembers = () => {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState("");
  const [savingRate, setSavingRate] = useState(false);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from("workers")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleting(false);
    setDeleteTarget(null);

    if (error) {
      toast.error("Kunde inte ta bort medlemmen");
      return;
    }

    toast.success(`${deleteTarget.name} har tagits bort`);
    queryClient.invalidateQueries({ queryKey: ["workers"] });
  };
  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) {
      toast.error("Lösenordet måste vara minst 6 tecken");
      return;
    }
    setResetting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ user_id: resetTarget.userId, new_password: newPassword }),
      }
    );
    const result = await res.json();
    setResetting(false);
    if (!res.ok) {
      toast.error(result.error || "Kunde inte återställa lösenord");
      return;
    }
    toast.success(`Lösenord för ${resetTarget.name} har återställts`);
    setResetTarget(null);
    setNewPassword("");
  };

  const handleSaveRate = async (workerId: string) => {
    const rate = parseFloat(rateValue);
    if (isNaN(rate) || rate < 0) {
      toast.error("Ange en giltig timlön");
      return;
    }
    setSavingRate(true);
    const { error } = await supabase
      .from("workers")
      .update({ hourly_rate: rate })
      .eq("id", workerId);
    setSavingRate(false);
    if (error) {
      toast.error("Kunde inte spara timlön");
      return;
    }
    toast.success("Timlön uppdaterad");
    setEditingRate(null);
    setRateValue("");
    queryClient.invalidateQueries({ queryKey: ["workers"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Teammedlemmar</h2>
          <span className="text-sm text-muted-foreground">({workers.length} aktiva)</span>
        </div>
      </div>

      {workers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga teammedlemmar ännu.</p>
      ) : (
        <div className="space-y-2">
          {workers.map((worker) => (
            <Card key={worker.id} className="p-3 flex items-center justify-between">
              <span className="font-medium text-foreground">{worker.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={() => setResetTarget({ userId: worker.user_id || "", name: worker.name })}
                  disabled={!worker.user_id}
                  title="Återställ lösenord"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ id: worker.id, name: worker.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort medlem</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <strong>{deleteTarget?.name}</strong> från teamet? Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Tar bort..." : "Ta bort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Återställ lösenord</DialogTitle>
            <DialogDescription>
              Ange ett nytt lösenord för <strong>{resetTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Nytt lösenord (minst 6 tecken)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button onClick={handleResetPassword} disabled={resetting} className="w-full">
              {resetting ? "Sparar..." : "Sätt nytt lösenord"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamMembers;
