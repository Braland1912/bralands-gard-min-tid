import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ChecklistManagerRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      const [{ data: role }, { data: worker }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle(),
        supabase
          .from("workers")
          .select("can_manage_checklists")
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      setAllowed(!!role || (worker as any)?.can_manage_checklists === true);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });
    check();
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default ChecklistManagerRoute;
