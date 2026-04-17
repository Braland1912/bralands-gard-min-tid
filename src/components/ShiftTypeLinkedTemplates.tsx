import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ListChecks, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  shiftType: string;
  shiftTypeLabel: string;
}

type Row = { id: string; template_id: string; sort_order: number; templates: { id: string; name: string } | null };

const ShiftTypeLinkedTemplates = ({ shiftType, shiftTypeLabel }: Props) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["shift-type-linked-templates", shiftType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_shift_types")
        .select("id, template_id, sort_order, templates:checklist_templates(id, name)")
        .eq("shift_type", shiftType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const removeLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("checklist_template_shift_types")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-type-linked-templates", shiftType] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-template-shift-types-full"] });
      toast({ title: "Koppling borttagen" });
    },
    onError: () => toast({ title: "Kunde inte ta bort", variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-12 w-full rounded-lg" />;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div>
        <p className="text-xs font-semibold text-foreground">Mallar kopplade till {shiftTypeLabel}</p>
        <p className="text-[10px] text-muted-foreground">
          Läggs till automatiskt på nya pass av denna typ.
        </p>
      </div>
      {links.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Inga kopplade mallar</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
            >
              <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">
                {l.templates?.name ?? "Okänd mall"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeLink.mutate(l.id)}
                disabled={removeLink.isPending}
                aria-label="Ta bort koppling"
                title="Ta bort koppling"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ShiftTypeLinkedTemplates;
