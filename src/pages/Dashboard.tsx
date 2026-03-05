import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ receitas: 0, despesas: 0, saldo: 0, aVencer: 0 });
  const [recentLancamentos, setRecentLancamentos] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
    const endOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

    const fetchStats = async () => {
      const { data: lancamentos } = await supabase
        .from("lancamentos")
        .select("*")
        .gte("data_vencimento", startOfMonth)
        .lte("data_vencimento", endOfMonth);

      if (lancamentos) {
        const receitas = lancamentos.filter(l => l.tipo === "receita").reduce((sum, l) => sum + Number(l.valor), 0);
        const despesas = lancamentos.filter(l => l.tipo === "despesa").reduce((sum, l) => sum + Number(l.valor), 0);
        const aVencer = lancamentos.filter(l => l.status === "a_vencer" && l.data_vencimento <= today).length;
        setStats({ receitas, despesas, saldo: receitas - despesas, aVencer });
      }

      const { data: recent } = await supabase
        .from("lancamentos")
        .select("*, categorias(nome, cor), contas(nome, icone)")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recent) setRecentLancamentos(recent);
    };

    fetchStats();
  }, [user]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: ptBR });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground capitalize">{currentMonth}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.receitas)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.despesas)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCurrency(stats.saldo)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.aVencer}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Lançamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLancamentos.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum lançamento ainda. Comece adicionando um!</p>
            ) : (
              <div className="space-y-3">
                {recentLancamentos.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{l.contas?.icone || "💰"}</span>
                      <div>
                        <p className="font-medium text-sm">{l.descricao}</p>
                        <p className="text-xs text-muted-foreground">{l.categorias?.nome} · {l.contas?.nome}</p>
                      </div>
                    </div>
                    <span className={`font-semibold text-sm ${l.tipo === "receita" ? "text-emerald-600" : "text-red-600"}`}>
                      {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
