//app.tsx

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { VideoProvider } from "./context/VideoContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { useAuth } from "./context/AuthContext";
import SecurityGuard from "./components/SecurityGuard";
import Header from "./components/Header";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./components/Login";
import Register from "./components/Register";
import ResetPassword from "./components/ResetPassword";
import AdminPanel from "./components/AdminPanel";
import ErrorPage from "./components/ErrorPage";
import { BanMessage } from "./components/BanMessage";
import Subscription from "./pages/Subscription";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import PaysafecardPayment from "./pages/PaysafecardPayment";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthLoading } = useAuth();
  
  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mb-4"></div>
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const App = () => (
  <SecurityGuard>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <VideoProvider>
            <BanMessage />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Routes publiques */}
                <Route path="/login" element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } />
                <Route path="/register" element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } />
                <Route path="/reset" element={
                  <PublicRoute>
                    <ResetPassword />
                  </PublicRoute>
                } />
                
                {/* Routes d'erreur et admin */}
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/error/:errorCode" element={<ErrorPage />} />
                <Route path="/404" element={<NotFound />} />
                
                {/* Routes d'abonnement (avec auth mais sans SubscriptionGuard) */}
                <Route path="/subscription" element={
                  <ProtectedRoute>
                    <Header />
                    <Subscription />
                  </ProtectedRoute>
                } />
                <Route path="/subscription/success" element={
                  <ProtectedRoute>
                    <SubscriptionSuccess />
                  </ProtectedRoute>
                } />
                <Route path="/payment/paysafecard" element={
                  <ProtectedRoute>
                    <PaysafecardPayment />
                  </ProtectedRoute>
                } />
                
                {/* Routes principales - SUPPRESSION du SubscriptionGuard global */}
                <Route path="/*" element={
                  <ProtectedRoute>
                    <Header />
                    <Index />
                  </ProtectedRoute>
                } />
              </Routes>
            </BrowserRouter>
            </VideoProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </SecurityGuard>
);

export default App;