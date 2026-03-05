import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];

const Relatorios = () => {
  const { user } = useAuth();
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: lancamentos } = await supabase
        .from("lancamentos")
        .select("*, categorias(nome, cor)")
        .order("data_vencimento");

      if (!lancamentos) return;

      // Monthly aggregation
      const monthly: Record<string, { receitas: number; despesas: number }> = {};
      lancamentos.forEach((l) => {
        const month = l.data_vencimento.substring(0, 7);
        if (!monthly[month]) monthly[month] = { receitas: 0, despesas: 0 };
        if (l.tipo === "receita") monthly[month].receitas += Number(l.valor);
        else monthly[month].despesas += Number(l.valor);
      });
      setMonthlyData(Object.entries(monthly).map(([month, data]) => ({ month, ...data })));

      // Category aggregation (expenses only)
      const cats: Record<string, { nome: string; valor: number; cor: string }> = {};
      lancamentos.filter(l => l.tipo === "despesa").forEach((l) => {
        const catName = l.categorias?.nome || "Sem categoria";
        const catCor = l.categorias?.cor || "#6b7280";
        if (!cats[catName]) cats[catName] = { nome: catName, valor: 0, cor: catCor };
        cats[catName].valor += Number(l.valor);
      });
      setCategoryData(Object.values(cats).sort((a, b) => b.valor - a.valor));
    };

    fetchData();
  }, [user]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receitas vs Despesas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados para exibir.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="receitas" fill="#10b981" name="Receitas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados para exibir.</p>
            ) : (
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={100} dataKey="valor" nameKey="nome" label={({ nome }) => nome}>
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.nome} fill={entry.cor || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 w-full lg:w-auto">
                  {categoryData.map((cat, i) => (
                    <div key={cat.nome} className="flex items-center justify-between gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.cor || COLORS[i % COLORS.length] }} />
                        <span>{cat.nome}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(cat.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Relatorios;
