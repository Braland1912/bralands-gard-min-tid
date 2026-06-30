import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLodgeEvents, departingUnitsForDate, LodgeUnit } from "@/lib/lodge-calendar";

/**
 * Synkar låsta lodge-checklistor på ett pass mot kalendern.
 *
 * Regler:
 *  - Endast DAGPASS får auto-kopplade checklistor.
 *  - För varje enhet med AVFÄRD (bytesdag) på passets datum:
 *      → om en mall har lodge_unit = enheten, säkerställ att den finns
 *        som shift_checklist (markerad med lodge_unit) på passet.
 *  - Befintliga shift_checklists med lodge_unit som inte längre matchar
 *    en avfärd på dagen tas bort.
 */
export function useSyncLodgeChecklists(
  shiftId: string | null | undefined,
  shiftType: string | null | undefined,
  shiftDate: string | null | undefined,
  enabled: boolean = true,
) {
  const queryClient = useQueryClient();
  const { data: cal } = useLodgeEvents();
  const runningRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!shiftId || !shiftType || !shiftDate) return;
    if (!cal?.events) return;

    const key = `${shiftId}|${shiftDate}|${shiftType}`;
    if (runningRef.current.has(key)) return;
    runningRef.current.add(key);

    const run = async () => {
      try {
        const wantedUnits: LodgeUnit[] =
          shiftType === "day" ? departingUnitsForDate(cal.events, shiftDate) : [];

        // Befintliga låsta lodge-checklistor på passet
        const { data: existing } = await supabase
          .from("shift_checklists")
          .select("id, lodge_unit")
          .eq("shift_id", shiftId)
          .not("lodge_unit", "is", null);

        const existingMap = new Map<string, string>(); // unit -> list id
        for (const row of existing ?? []) {
          if (row.lodge_unit) existingMap.set(row.lodge_unit, row.id);
        }

        const toRemove = (existing ?? [])
          .filter((r) => !r.lodge_unit || !wantedUnits.includes(r.lodge_unit as LodgeUnit))
          .map((r) => r.id);

        const toAdd = wantedUnits.filter((u) => !existingMap.has(u));

        let changed = false;

        if (toRemove.length > 0) {
          await supabase.from("shift_checklists").delete().in("id", toRemove);
          changed = true;
        }

        if (toAdd.length > 0) {
          // 1) Mallar direkt kopplade till enheten
          const { data: tplsDirect } = await supabase
            .from("checklist_templates")
            .select("id, name, lodge_unit, description, group_id, checklist_template_groups(name, color)" as any)
            .in("lodge_unit", toAdd as string[]);

          // 2) Grupper kopplade till enheten → alla mallar i dessa grupper
          const { data: groupsForUnits } = await supabase
            .from("checklist_template_groups" as any)
            .select("id, lodge_unit")
            .in("lodge_unit", toAdd as string[]);
          const groupIds = ((groupsForUnits ?? []) as any[]).map((g) => g.id);
          const groupUnitMap = new Map<string, string>(
            ((groupsForUnits ?? []) as any[]).map((g) => [g.id, g.lodge_unit]),
          );

          let tplsViaGroup: any[] = [];
          if (groupIds.length > 0) {
            const { data: tplsG } = await supabase
              .from("checklist_templates")
              .select("id, name, lodge_unit, description, group_id, checklist_template_groups(name, color)" as any)
              .in("group_id", groupIds);
            // Ge dessa mallar en "effective" lodge_unit från gruppen om de saknar egen
            tplsViaGroup = ((tplsG ?? []) as any[]).map((t) => ({
              ...t,
              lodge_unit: t.lodge_unit ?? groupUnitMap.get(t.group_id) ?? null,
            }));
          }

          // Slå ihop och deduplicera per template-id
          const combined = new Map<string, any>();
          for (const t of (tplsDirect ?? []) as any[]) combined.set(t.id, t);
          for (const t of tplsViaGroup) if (!combined.has(t.id)) combined.set(t.id, t);

          // Filtrera bort mallar vars effective lodge_unit inte är efterfrågad
          const templates = Array.from(combined.values()).filter(
            (t) => t.lodge_unit && toAdd.includes(t.lodge_unit) && !existingMap.has(t.lodge_unit),
          );
          if (templates.length > 0) {
            const tplIds = templates.map((t) => t.id);
            const { data: tplItems } = await supabase
              .from("checklist_template_items")
              .select("template_id, text, sort_order, description" as any)
              .in("template_id", tplIds)
              .order("sort_order", { ascending: true });

            // Hämta nästa sort_order
            const { data: cur } = await supabase
              .from("shift_checklists")
              .select("sort_order")
              .eq("shift_id", shiftId);
            let nextSort = (cur ?? []).length;

            for (const tpl of templates) {
              if (!tpl.lodge_unit) continue;
              const grp = (tpl as any).checklist_template_groups ?? null;
              const { data: created, error: insErr } = await supabase
                .from("shift_checklists")
                .insert({
                  shift_id: shiftId,
                  name: tpl.name,
                  sort_order: nextSort++,
                  lodge_unit: tpl.lodge_unit,
                  description: tpl.description ?? null,
                  group_name: grp?.name ?? null,
                  group_color: grp?.color ?? null,
                } as any)
                .select("id")
                .single();
              if (insErr || !created) continue;
              const items = ((tplItems ?? []) as any[]).filter((it) => it.template_id === tpl.id);
              if (items.length > 0) {
                await supabase.from("shift_checklist_items").insert(
                  items.map((it: any, idx) => ({
                    shift_checklist_id: created.id,
                    text: it.text,
                    sort_order: idx,
                    description: it.description ?? null,
                  })),
                );
              }
              changed = true;
            }
          }
        }

        if (changed) {
          queryClient.invalidateQueries({ queryKey: ["shift-checklists", shiftId] });
          queryClient.invalidateQueries({ queryKey: ["shift-checklists-collapsed", shiftId] });
          queryClient.invalidateQueries({ queryKey: ["home-shift-checklists", shiftId] });
          queryClient.invalidateQueries({ queryKey: ["shift-checklist-items"] });
          queryClient.invalidateQueries({ queryKey: ["shift-checklist-counts"] });
        }
      } catch (e) {
        // Tyst — sync är best-effort.
        console.warn("[lodge sync] failed:", e);
      } finally {
        runningRef.current.delete(key);
      }
    };

    run();
  }, [enabled, shiftId, shiftType, shiftDate, cal?.events, queryClient]);
}
