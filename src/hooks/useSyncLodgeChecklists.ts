import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const runningRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!shiftId || !shiftType || !shiftDate) return;
    if (shiftType !== "day") return;

    const key = `${shiftId}|${shiftDate}|${shiftType}`;
    if (runningRef.current.has(key)) return;
    runningRef.current.add(key);

    const run = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("sync-lodge-checklists", {
          body: { shiftId, shiftDate, shiftType },
        });
        if (error) throw error;
        const changed = Boolean((data as any)?.changed);

        if (changed) {
          queryClient.invalidateQueries({ queryKey: ["shift-checklists-viewer", shiftId] });
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
  }, [enabled, shiftId, shiftType, shiftDate, queryClient]);
}
