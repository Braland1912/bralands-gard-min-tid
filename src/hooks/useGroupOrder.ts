import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hämtar grupp-ordningen (namn -> sort_order) från checklist_template_groups.
 * Används för att sortera grupperade shift_checklists i medarbetarvyerna
 * så att t.ex. "Avslutning av pass" alltid hamnar sist – även när
 * lodge-checklistor lagts till efter den synkades.
 */
export const useGroupOrder = () => {
  return useQuery({
    queryKey: ["checklist-group-order"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_template_groups")
        .select("name, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((g: any) => map.set(g.name, g.sort_order));
      return map;
    },
  });
};

export const sortGroups = <T extends { name: string | null }>(
  grouped: T[],
  orderMap: Map<string, number> | undefined,
): T[] => {
  if (!orderMap) return grouped;
  const BIG = 1e9;
  return [...grouped].sort((a, b) => {
    const ao = a.name ? orderMap.get(a.name) ?? BIG : BIG + 1;
    const bo = b.name ? orderMap.get(b.name) ?? BIG : BIG + 1;
    return ao - bo;
  });
};
