import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ServiceSelection from "./pages/ServiceSelection";
import QueueStatus from "./pages/QueueStatus";
import VisitorAuth from "./pages/VisitorAuth";
import TokenHistory from "./pages/TokenHistory";
import StaffLogin from "./pages/StaffLogin";
import StaffDashboard from "./pages/StaffDashboard";
import StaffSessions from "./pages/StaffSessions";
import StaffTokens from "./pages/StaffTokens";
import StaffSessionHistory from "./pages/StaffSessionHistory";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ServiceSelection />} />
            <Route path="/queue/:tokenId" element={<QueueStatus />} />
            <Route path="/auth" element={<VisitorAuth />} />
            <Route path="/history" element={<TokenHistory />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/staff/sessions" element={<StaffSessions />} />
            <Route path="/staff/tokens" element={<StaffTokens />} />
            <Route path="/staff/session-history" element={<StaffSessionHistory />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
