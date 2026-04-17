import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ListChecks, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type Template = { id: string; name: string };
type Item = { id: string; template_id: string; text: string; sort_order: number };

const AdminChecklists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [newItemText, setNewItemText] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!user,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["checklist-template-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
    enabled: !!user,
  });

  const countFor = (id: string) => allItems.filter((i) => i.template_id === id).length;

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .insert({ name: "Ny mall" })
        .select()
        .single();
      if (error) throw error;
      return data as Template;
    },
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      openEdit(tpl, []);
    },
    onError: () => toast({ title: "Kunde inte skapa mall", variant: "destructive" }),
  });

  const openEdit = (tpl: Template, items: Item[]) => {
    setEditing(tpl);
    setEditName(tpl.name);
    setEditItems(items);
    setNewItemText("");
  };

  const handleOpenExisting = (tpl: Template) => {
    const items = allItems.filter((i) => i.template_id === tpl.id);
    openEdit(tpl, items);
  };

  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    setEditItems((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}-${Math.random()}`, template_id: editing!.id, text, sort_order: prev.length },
    ]);
    setNewItemText("");
  };

  const updateItemText = (id: string, text: string) => {
    setEditItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  const removeItem = (id: string) => {
    setEditItems((prev) => prev.filter((i) => i.id !== id));
  };

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const name = editName.trim() || "Namnlös mall";
      const { error: nameErr } = await supabase
        .from("checklist_templates")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (nameErr) throw nameErr;

      // Replace all items: delete + insert
      const { error: delErr } = await supabase
        .from("checklist_template_items")
        .delete()
        .eq("template_id", editing.id);
      if (delErr) throw delErr;

      const filtered = editItems.map((i, idx) => ({ text: i.text.trim(), sort_order: idx, template_id: editing.id }))
        .filter((i) => i.text.length > 0);

      if (filtered.length > 0) {
        const { error: insErr } = await supabase.from("checklist_template_items").insert(filtered);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-items"] });
      setEditing(null);
      toast({ title: "Mall sparad" });
    },
    onError: () => toast({ title: "Kunde inte spara", variant: "destructive" }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("checklist_templates").delete().eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-items"] });
      setEditing(null);
      toast({ title: "Mall borttagen" });
    },
    onError: () => toast({ title: "Kunde inte ta bort", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background" style={{ colorScheme: "light" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Checklistor</h1>
            <p className="text-xs text-muted-foreground">Mallar för återkommande uppgifter</p>
          </div>
          <Button onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ny mall
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <Card className="p-10 text-center">
            <ListChecks className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Inga mallar ännu. Skapa din första mall.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleOpenExisting(tpl)}
                className="text-left"
              >
                <Card className="p-4 hover:bg-muted/30 transition-colors h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="text-sm font-semibold text-foreground truncate">{tpl.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {countFor(tpl.id)} {countFor(tpl.id) === 1 ? "punkt" : "punkter"}
                      </p>
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera mall</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Namn</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Mallnamn" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Punkter</label>
              <div className="space-y-2">
                {editItems.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Inga punkter än.</p>
                )}
                {editItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Input
                      value={item.text}
                      onChange={(e) => updateItemText(item.id, e.target.value)}
                      placeholder="Punkt..."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  placeholder="Lägg till ny punkt..."
                />
                <Button variant="outline" onClick={handleAddItem} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Lägg till
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={() => deleteTemplate.mutate()}
              disabled={deleteTemplate.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort mall
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Avbryt</Button>
            <Button onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending}>
              {saveTemplate.isPending ? "Sparar..." : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminChecklists;
