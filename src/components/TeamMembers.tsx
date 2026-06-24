import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Users, KeyRound, DollarSign, Check, X, Mail, Copy, Phone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

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

  const { data: emailMap = {} } = useQuery({
    queryKey: ["user-emails"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return {};
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-user-emails`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) return {};
      const result = await res.json();
      return (result.emails || {}) as Record<string, string>;
    },
  });

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("E-post kopierad");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("workers").delete().eq("id", deleteTarget.id);
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
    const { error } = await supabase.from("workers").update({ hourly_rate: rate }).eq("id", workerId);
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

  const handleSavePhone = async (workerId: string) => {
    const phone = phoneValue.trim();
    setSavingPhone(true);
    const { error } = await supabase
      .from("workers")
      .update({ phone: phone || null } as any)
      .eq("id", workerId);
    setSavingPhone(false);
    if (error) {
      toast.error("Kunde inte spara telefonnummer");
      return;
    }
    toast.success("Telefonnummer uppdaterat");
    setEditingPhone(null);
    setPhoneValue("");
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
          {workers.map((worker) => {
            const email = worker.user_id ? emailMap[worker.user_id] : null;
            return (
              <Card key={worker.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{worker.name}</span>
                    {email && (
                      <div className="flex items-center gap-1 mt-0.5 group">
                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <a
                          href={`mailto:${email}`}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors truncate"
                        >
                          {email}
                        </a>
                        <button
                          onClick={() => copyEmail(email)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                          title="Kopiera e-post"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
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
                </div>
                <div className="flex items-center gap-2">
                  {editingRate === worker.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={rateValue}
                        onChange={(e) => setRateValue(e.target.value)}
                        className="h-8 w-24 text-sm"
                        placeholder="0"
                        autoFocus
                      />
                      <span className="text-sm text-muted-foreground">kr/h</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleSaveRate(worker.id)} disabled={savingRate}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => { setEditingRate(null); setRateValue(""); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setEditingRate(worker.id); setRateValue(String(worker.hourly_rate || 0)); }}
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>{worker.hourly_rate || 0} kr/h</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">Kan se teamets schema</span>
                  <Switch
                    checked={worker.can_see_team === true}
                    onCheckedChange={async (v) => {
                      const { error } = await supabase
                        .from("workers")
                        .update({ can_see_team: v })
                        .eq("id", worker.id);
                      if (error) {
                        toast.error("Kunde inte uppdatera behörighet");
                        return;
                      }
                      queryClient.invalidateQueries({ queryKey: ["workers"] });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">Kan se uthyrningskalendern</span>
                  <Switch
                    checked={(worker as any).can_see_lodge === true}
                    onCheckedChange={async (v) => {
                      const { error } = await supabase
                        .from("workers")
                        .update({ can_see_lodge: v } as any)
                        .eq("id", worker.id);
                      if (error) {
                        toast.error("Kunde inte uppdatera behörighet");
                        return;
                      }
                      queryClient.invalidateQueries({ queryKey: ["workers"] });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Visa aktivitetslogg vid instämpling</span>
                    <span className="text-[10px] text-muted-foreground/70">Schemalagda pass använder alltid passets checklistor.</span>
                  </div>
                  <Switch
                    checked={(worker as any).show_activity_log === true}
                    onCheckedChange={async (v) => {
                      const { error } = await supabase
                        .from("workers")
                        .update({ show_activity_log: v } as any)
                        .eq("id", worker.id);
                      if (error) {
                        toast.error("Kunde inte uppdatera inställning");
                        return;
                      }
                      queryClient.invalidateQueries({ queryKey: ["workers"] });
                    }}
                  />
                </div>
              </Card>
            );
          })}
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
