import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  lodge_unit?: string | null;
  is_evening_round?: boolean;
};

export type GroupShiftLink = { group_id: string; shift_type: string };

const PALETTE = [
  "#4e8283", "#b45309", "#0369a1", "#7c3aed",
  "#be185d", "#15803d", "#b91c1c", "#475569",
];

const SHIFT_OPTIONS = [
  { value: "morning", label: "Morgon", emoji: "🌅" },
  { value: "day", label: "Dag", emoji: "☀️" },
  { value: "evening", label: "Kväll", emoji: "🌙" },
  { value: "fishing", label: "Guidning", emoji: "🎣" },
  { value: "clearing", label: "Gården", emoji: "🚜" },
];

const LODGE_OPTIONS: { value: string; label: string }[] = [
  { value: "Öringen",       label: "Nr. 1 Öringen" },
  { value: "Laxen",         label: "Nr. 2 Laxen" },
  { value: "Kungsfiskaren", label: "Nr. 3 Kungsfiskaren" },
  { value: "Strömstaren",   label: "Nr. 4 Strömstaren" },
  { value: "Husvagnen",     label: "Nr. 5 Husvagnen" },
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

export const useChecklistGroupShiftTypes = () =>
  useQuery({
    queryKey: ["checklist-group-shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_group_shift_types" as any)
        .select("group_id, shift_type");
      if (error) throw error;
      return ((data ?? []) as unknown) as GroupShiftLink[];
    },
  });

const ChecklistGroupsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: groups = [] } = useChecklistGroups();
  const { data: allShiftLinks = [] } = useChecklistGroupShiftTypes();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(PALETTE[0]);
  const [draftShiftTypes, setDraftShiftTypes] = useState<string[]>([]);
  const [draftLodgeUnit, setDraftLodgeUnit] = useState<string | null>(null);
  const [draftIsEveningRound, setDraftIsEveningRound] = useState(false);

  const reset = () => {
    setEditId(null);
    setDraftName("");
    setDraftColor(PALETTE[0]);
    setDraftShiftTypes([]);
    setDraftLodgeUnit(null);
    setDraftIsEveningRound(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      const name = draftName.trim();
      if (!name) throw new Error("Namn saknas");
      // Om denna grupp ska bli kvällsrundans grupp – nollställ ev. tidigare först
      if (draftIsEveningRound) {
        await supabase
          .from("checklist_template_groups" as any)
          .update({ is_evening_round: false })
          .eq("is_evening_round", true)
          .neq("id", editId ?? "00000000-0000-0000-0000-000000000000");
      }
      let groupId = editId;
      if (editId) {
        const { error } = await supabase
          .from("checklist_template_groups" as any)
          .update({
            name,
            color: draftColor,
            lodge_unit: draftLodgeUnit,
            is_evening_round: draftIsEveningRound,
          })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const next = (groups[groups.length - 1]?.sort_order ?? -1) + 1;
        const { data, error } = await supabase
          .from("checklist_template_groups" as any)
          .insert({
            name,
            color: draftColor,
            sort_order: next,
            lodge_unit: draftLodgeUnit,
            is_evening_round: draftIsEveningRound,
          })
          .select("id")
          .single();
        if (error) throw error;
        groupId = (data as any)?.id ?? null;
      }
      if (!groupId) return;
      // Sync shift type links
      await supabase
        .from("checklist_group_shift_types" as any)
        .delete()
        .eq("group_id", groupId);
      if (draftShiftTypes.length > 0) {
        const { error: insErr } = await supabase
          .from("checklist_group_shift_types" as any)
          .insert(draftShiftTypes.map((st) => ({ group_id: groupId, shift_type: st })));
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-template-groups"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-group-shift-types"] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-checklist-items"] });
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
      queryClient.invalidateQueries({ queryKey: ["checklist-group-shift-types"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
    },
    onError: () => toast({ title: "Kunde inte ta bort", variant: "destructive" }),
  });

  const startEdit = (g: ChecklistGroup) => {
    setEditId(g.id);
    setDraftName(g.name);
    setDraftColor(g.color);
    setDraftLodgeUnit((g.lodge_unit ?? null) as string | null);
    setDraftIsEveningRound(!!g.is_evening_round);
    setDraftShiftTypes(allShiftLinks.filter((l) => l.group_id === g.id).map((l) => l.shift_type));
  };

  const shiftLabelsFor = (id: string) =>
    allShiftLinks
      .filter((l) => l.group_id === id)
      .map((l) => SHIFT_OPTIONS.find((s) => s.value === l.shift_type)?.label ?? l.shift_type);

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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grupper för checklistor</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Grupper organiserar mallar och kan kopplas till passtyper och lodge-enheter — då läggs alla mallar i gruppen automatiskt på matchande pass.
          </p>

          {groups.length > 0 && (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {groups.map((g) => {
                const labels = shiftLabelsFor(g.id);
                return (
                  <li
                    key={g.id}
                    className="flex items-start gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full shrink-0 mt-1"
                      style={{ backgroundColor: g.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{g.name}</div>
                      {(labels.length > 0 || g.lodge_unit || g.is_evening_round) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {labels.map((l) => (
                            <span key={l} className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">{l}</span>
                          ))}
                          {g.lodge_unit && (
                            <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">
                              {LODGE_OPTIONS.find((u) => u.value === g.lodge_unit)?.label ?? g.lodge_unit}
                            </span>
                          )}
                          {g.is_evening_round && (
                            <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">
                              Kvällsrundan
                            </span>
                          )}
                        </div>
                      )}
                    </div>
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
                );
              })}
            </ul>
          )}

          <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
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

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">
                Lägg till alla mallar i gruppen automatiskt på passtyper
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SHIFT_OPTIONS.map((opt) => {
                  const checked = draftShiftTypes.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer text-sm ${
                        checked ? "bg-background border-foreground/30" : "border-border bg-muted/30"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setDraftShiftTypes((prev) =>
                            v === true ? [...prev, opt.value] : prev.filter((s) => s !== opt.value),
                          )
                        }
                      />
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">
                Koppla gruppen till lodge-enhet (valfritt)
              </div>
              <select
                value={draftLodgeUnit ?? ""}
                onChange={(e) => setDraftLodgeUnit(e.target.value || null)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Ingen koppling —</option>
                {LODGE_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Triggar på dagpass när enheten har avfärd (bytesdag).
              </p>
            </div>

            <label
              className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm ${
                draftIsEveningRound ? "bg-primary/5 border-primary/40" : "border-border bg-muted/30"
              }`}
            >
              <Checkbox
                checked={draftIsEveningRound}
                onCheckedChange={(v) => setDraftIsEveningRound(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="font-medium">Använd som Kvällsrundans checklista</div>
                <p className="text-[10px] text-muted-foreground">
                  Alla mallar i gruppen visas på fliken Lista i Kvällsrundan. Endast en grupp åt gången.
                </p>
              </div>
            </label>

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
