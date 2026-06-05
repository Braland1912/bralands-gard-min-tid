import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  useCreateTaskCategory,
  useUpdateTaskCategory,
  type ManagedTaskCategory,
} from "@/hooks/useManageTaskCategories";

const schema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: "Namn får inte vara tomt" })
    .max(60, { message: "Max 60 tecken" }),
  requires_note: z.boolean(),
  is_break: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ManagedTaskCategory | null;
}

const TaskCategoryDialog = ({ open, onOpenChange, editing }: Props) => {
  const create = useCreateTaskCategory();
  const update = useUpdateTaskCategory();
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: "",
      requires_note: false,
      is_break: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        label: editing.label,
        requires_note: editing.requires_note,
        is_break: editing.is_break,
      });
      setItems(editing.checklist_items ?? []);
    } else {
      form.reset({ label: "", requires_note: false, is_break: false });
      setItems([]);
    }
    setNewItem("");
  }, [open, editing, form]);

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setItems((prev) => [...prev, v]);
    setNewItem("");
  };

  const updateItem = (idx: number, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? value : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (values: FormValues) => {
    const cleanedItems = items.map((s) => s.trim()).filter(Boolean);
    const payload = {
      label: values.label.trim(),
      requires_note: values.requires_note,
      is_break: values.is_break,
      checklist_items: cleanedItems,
    };
    try {
      if (editing) {
        await update.mutateAsync({ ...payload, id: editing.id });
      } else {
        await create.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast hanteras i hooken
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Redigera uppgift" : "Lägg till uppgift"}
          </DialogTitle>
          <DialogDescription>
            Chips visas för medarbetare när de är instämplade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-label" className="text-sm font-medium">
              Namn
            </Label>
            <Input
              id="task-label"
              autoFocus
              placeholder="T.ex. Diskning"
              className="h-12"
              {...form.register("label")}
            />
            {form.formState.errors.label && (
              <p className="text-xs text-destructive">
                {form.formState.errors.label.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Kräver notering</Label>
              <p className="text-xs text-muted-foreground">
                Medarbetaren måste skriva en kort text för att starta.
              </p>
            </div>
            <Switch
              checked={form.watch("requires_note")}
              onCheckedChange={(v) => form.setValue("requires_note", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Rast</Label>
              <p className="text-xs text-muted-foreground">
                Tiden räknas som rast och dras av från arbetstiden.
              </p>
            </div>
            <Switch
              checked={form.watch("is_break")}
              onCheckedChange={(v) => form.setValue("is_break", v)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Checklistepunkter</Label>
            <p className="text-xs text-muted-foreground">
              Punkter som medarbetaren kan bocka av medan uppgiften pågår.
            </p>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateItem(idx, e.target.value)}
                    className="h-11"
                    maxLength={120}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(idx)}
                    aria-label="Ta bort punkt"
                    className="h-11 w-11 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="Ny punkt…"
                  className="h-11"
                  maxLength={120}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addItem}
                  disabled={!newItem.trim()}
                  aria-label="Lägg till punkt"
                  className="h-11 w-11 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Spara
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskCategoryDialog;
