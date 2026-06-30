import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FolderOpen, X, Check, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ChecklistGroup = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

const PALETTE = [
  "#4e8283", "#b45309", "#0369a1", "#7c3aed",
  "#be185d", "#15803d", "#b91c1c", "#475569",
];

export const useChecklistGroups = () =>
  useQuery({
    queryKey: ["checklist-template-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_groups" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as ChecklistGroup[];
    },
  });

const ChecklistGroupsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: groups = [] } = useChecklistGroups();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(PALETTE[0]);

  const reset = () => {
    setEditId(null);
    setDraftName("");
    setDraftColor(PALETTE[0]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const name = draftName.trim();
      if (!name) throw new Error("Namn saknas");
      if (editId) {
        const { error } = await supabase
          .from("checklist_template_groups" as any)
          .update({ name, color: draftColor })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const next = (groups[groups.length - 1]?.sort_order ?? -1) + 1;
        const { error } = await supabase
          .from("checklist_template_groups" as any)
          .insert({ name, color: draftColor, sort_order: next });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-template-groups"] });
      reset();
    },
    onError: (e: Error) =>
      toast({ title: "Kunde inte spara grupp", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("checklist_template_groups" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-template-groups"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
    },
    onError: () => toast({ title: "Kunde inte ta bort", variant: "destructive" }),
  });

  const startEdit = (g: ChecklistGroup) => {
    setEditId(g.id);
    setDraftName(g.name);
    setDraftColor(g.color);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Hantera grupper
          {groups.length > 0 && (
            <span className="text-xs text-muted-foreground">({groups.length})</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Grupper för checklistor</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Grupper organiserar mallar i admin-listan och visas som rubrik för medarbetarna på passet.
          </p>

          {groups.length > 0 && (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="text-sm flex-1 truncate">{g.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => startEdit(g)}
                    aria-label="Redigera"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => {
                      if (confirm(`Ta bort gruppen "${g.name}"? Mallar i gruppen blir ogrupperade.`)) {
                        remove.mutate(g.id);
                      }
                    }}
                    aria-label="Ta bort"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
            <div className="text-xs font-medium text-muted-foreground">
              {editId ? "Redigera grupp" : "Ny grupp"}
            </div>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Gruppnamn (t.ex. Lodge, Säsong)"
              maxLength={50}
            />
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraftColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    draftColor === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Färg ${c}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {editId && (
                <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  Avbryt
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={!draftName.trim() || save.isPending}
                className="gap-1.5 flex-1"
              >
                {editId ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editId ? "Spara" : "Lägg till"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChecklistGroupsManager;
