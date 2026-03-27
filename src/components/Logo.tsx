import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.svg";

const Logo = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleClick = () => {
    navigate(isLoggedIn ? "/" : "/login");
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center focus:outline-none"
      aria-label="Gå till startsidan"
    >
      <img src={logo} alt="Brålands Gård" className="h-10 sm:h-12 w-auto" />
    </button>
  );
};

export default Logo;
