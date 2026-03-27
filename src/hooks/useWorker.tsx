import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useWorker = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["my-worker", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};
