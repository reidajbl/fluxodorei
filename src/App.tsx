import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DadosProvider } from "@/contexts/DadosContext";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Lancamentos from "./pages/Lancamentos";
import Contas from "./pages/Contas";
import DespesasFixas from "./pages/DespesasFixas";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import LogsAuditoria from "./pages/LogsAuditoria";
import Diagnostico from "./pages/Diagnostico";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DadosProvider>
          <DashboardProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/lancamentos" element={<Navigate to="/dashboard" replace />} />
            <Route path="/despesas-fixas" element={<ProtectedRoute><DespesasFixas /></ProtectedRoute>} />
            <Route path="/contas" element={<ProtectedRoute><Contas /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/logs" element={<ProtectedRoute><LogsAuditoria /></ProtectedRoute>} />
            <Route path="/diagnostico" element={<ProtectedRoute><Diagnostico /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </DashboardProvider>
          </DadosProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
