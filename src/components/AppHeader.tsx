import { useLocation } from "react-router-dom";
import Logo from "./Logo";

const AppHeader = () => {
  const location = useLocation();
  
  // Hide header on admin dashboard (has its own header)
  if (location.pathname === "/admin/dashboard") return null;

  return (
    <header className="w-full border-b border-border bg-background px-4 py-3 flex items-center">
      <Logo />
    </header>
  );
};

export default AppHeader;
