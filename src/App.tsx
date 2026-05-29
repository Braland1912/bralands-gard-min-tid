import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Confirmation from "./pages/Confirmation";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Register from "./pages/Register";
import MemberLogin from "./pages/MemberLogin";
import MyTime from "./pages/MyTime";
import MySchedule from "./pages/MySchedule";
import AdminSchedule from "./pages/AdminSchedule";
import AdminChecklists from "./pages/AdminChecklists";
import EveningRound from "./pages/EveningRound";
import EveningRoundHelp from "./pages/EveningRoundHelp";
import MobileMenuTest from "./pages/MobileMenuTest";
import EveningRoundWidgetTest from "./pages/EveningRoundWidgetTest";

import NotFound from "./pages/NotFound";
import AppHeader from "./components/AppHeader";
import DesktopSidebar from "./components/DesktopSidebar";
import InstallAppModal from "./components/InstallAppModal";
import UpdateBanner from "./components/UpdateBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 10000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UpdateBanner />
        <InstallAppModal />
        <DesktopSidebar />
        <AppHeader />
        <div className="md:pl-64">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/invite/:token" element={<Register />} />
          <Route path="/login" element={<MemberLogin />} />
          <Route path="/my-time" element={<MyTime />} />
          
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/my-schedule" element={<MySchedule />} />
          <Route path="/admin/schedule" element={
            <ProtectedRoute>
              <AdminSchedule />
            </ProtectedRoute>
          } />
          <Route path="/evening-round" element={<EveningRound />} />
          <Route path="/evening-round/help" element={<EveningRoundHelp />} />
          <Route path="/admin/checklists" element={
            <ProtectedRoute>
              <AdminChecklists />
            </ProtectedRoute>
          } />
          <Route path="/dev/mobile-test" element={<MobileMenuTest />} />
          <Route path="/dev/evening-widget-test" element={<EveningRoundWidgetTest />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
