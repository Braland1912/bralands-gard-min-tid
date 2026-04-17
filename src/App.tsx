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

import NotFound from "./pages/NotFound";
import AppHeader from "./components/AppHeader";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppHeader />
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
          <Route path="/admin/checklists" element={
            <ProtectedRoute>
              <AdminChecklists />
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
