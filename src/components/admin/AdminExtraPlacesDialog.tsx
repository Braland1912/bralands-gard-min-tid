import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface Props {
  /** Aktiv runda för dagen — så vi kan markera "denna runda" i listan */
  currentRoundId?: string | null;
}

interface ExtraPlaceRow {
  id: string;
  evening_round_id: string;
  label: string;
  created_at: string;
  round_date: string | null;
  guest_count: number;
}

const AdminExtraPlacesDialog = ({ currentRoundId }: Props) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<ExtraPlaceRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-extra-places-all"],
    queryFn: async () => {
      // 1) Hämta alla extra-platser (senast först)
      const { data: places, error } = await supabase
        .from("evening_round_extra_places")
        .select("id, evening_round_id, label, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = places ?? [];
      if (list.length === 0) return [] as ExtraPlaceRow[];

      // 2) Hämta motsvarande runda-datum
      const roundIds = Array.from(new Set(list.map((p) => p.evening_round_id)));
      const { data: rounds } = await supabase
        .from("evening_rounds")
        .select("id, round_date")
        .in("id", roundIds);
      const dateById = new Map((rounds ?? []).map((r: any) => [r.id, r.round_date]));

      // 3) Räkna gäster kopplade per (round, label)
      const { data: guests } = await supabase
        .from("evening_round_guests")
        .select("evening_round_id, place_label")
        .in("evening_round_id", roundIds);
      const countByKey = new Map<string, number>();
      (guests ?? []).forEach((g: any) => {
        if (!g.place_label) return;
        const key = `${g.evening_round_id}::${g.place_label}`;
        countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
      });

      return list.map((p) => ({
        id: p.id,
        evening_round_id: p.evening_round_id,
        label: p.label,
        created_at: p.created_at,
        round_date: dateById.get(p.evening_round_id) ?? null,
        guest_count: countByKey.get(`${p.evening_round_id}::${p.label}`) ?? 0,
      })) as ExtraPlaceRow[];
    },
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: ExtraPlaceRow) => {
      // Ta bort kopplade gäster först (om några), sen platsen
      if (row.guest_count > 0) {
        const { error: gErr } = await supabase
          .from("evening_round_guests")
          .delete()
          .eq("evening_round_id", row.evening_round_id)
          .eq("place_label", row.label);
        if (gErr) throw gErr;
      }
      const { error } = await supabase
        .from("evening_round_extra_places")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      toast.success(
        row.guest_count > 0
          ? `Plats "${row.label}" och ${row.guest_count} ${
              row.guest_count === 1 ? "bokning" : "bokningar"
            } togs bort`
          : `Plats "${row.label}" togs bort`,
      );
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["admin-extra-places-all"] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-extra-places"] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-guests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte ta bort plats"),
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return "Okänt datum";
    try {
      const [y, m, d] = iso.split("-").map(Number);
      return format(new Date(y, m - 1, d), "EEE d MMM yyyy", { locale: sv });
    } catch {
      return iso;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Hantera platser</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Hantera extra platser</DialogTitle>
            <DialogDescription>
              Översikt över alla egna platser som lagts till i kvällsrundor. Du kan ta bort dem här,
              även om bokningar finns kopplade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Inga extra platser har skapats ännu.
              </div>
            ) : (
              rows.map((row) => {
                const isCurrent = row.evening_round_id === currentRoundId;
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">{row.label}</span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[10px]">
                            Dagens runda
                          </Badge>
                        )}
                        {row.guest_count > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-300 bg-amber-50 text-amber-800"
                          >
                            {row.guest_count} {row.guest_count === 1 ? "bokning" : "bokningar"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Runda {formatDate(row.round_date)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirm(row)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      aria-label={`Ta bort ${row.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort platsen "{confirm?.label}"?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Platsen försvinner från rundan {formatDate(confirm?.round_date ?? null)}.
                </p>
                {confirm && confirm.guest_count > 0 && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">
                      {confirm.guest_count}{" "}
                      {confirm.guest_count === 1 ? "bokning kommer också" : "bokningar kommer också"}{" "}
                      tas bort. Det går inte att ångra.
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirm) deleteMutation.mutate(confirm);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Tar bort…
                </>
              ) : (
                "Ta bort"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminExtraPlacesDialog;
