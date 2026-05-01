import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Save } from "lucide-react";
import { toast } from "sonner";
import { EVENING_CHECKLIST_SETTING_KEY } from "@/hooks/useEveningRoundSummary";

type Template = { id: string; name: string };

const EveningRoundChecklistPicker = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data: templates = [] } = useQuery({
    queryKey: ["checklist-templates-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const { data: current } = useQuery({
    queryKey: ["app-settings", EVENING_CHECKLIST_SETTING_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", EVENING_CHECKLIST_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      const raw = data?.value as unknown;
      return typeof raw === "string" ? raw : null;
    },
  });

  useEffect(() => {
    if (current) setSelected(current);
  }, [current]);

  const save = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: EVENING_CHECKLIST_SETTING_KEY,
            value: templateId as never,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mall sparad för kvällsrundan");
      queryClient.invalidateQueries({ queryKey: ["app-settings", EVENING_CHECKLIST_SETTING_KEY] });
      queryClient.invalidateQueries({ queryKey: ["evening-round-checklist-items"] });
    },
    onError: (e: Error) => toast.error("Kunde inte spara", { description: e.message }),
  });

  const isDirty = selected && selected !== current;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
          <Moon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Mall för kvällsrundan</h2>
          <p className="text-xs text-muted-foreground">
            Välj vilken mall som visas som checklista i kvällsrundan.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="evening-template" className="text-xs">
            Vald mall
          </Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="evening-template">
              <SelectValue placeholder="Välj mall…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => save.mutate(selected)}
          disabled={!isDirty || save.isPending}
          className="sm:w-auto"
        >
          <Save className="h-4 w-4 mr-1.5" />
          Spara
        </Button>
      </div>
    </Card>
  );
};

export default EveningRoundChecklistPicker;
