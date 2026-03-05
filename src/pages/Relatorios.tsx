import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];

const Relatorios = () => {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);

  const { ano: anoAtual, mes: mesAtual } = dateHelper.mesAnoAtual();
  const [mesView, setMesView] = useState(mesAtual);
  const [anoView, setAnoView] = useState(anoAtual);

  const mesAnterior = () => {
    if (mesView === 1) { setMesView(12); setAnoView(anoView - 1); }
    else setMesView(mesView - 1);
  };
  const mesProximo = () => {
    if (mesView === 12) { setMesView(1); setAnoView(anoView + 1); }
    else setMesView(mesView + 1);
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: l }, { data: c }] = await Promise.all([
        supabase.from("lancamentos").select("*, categorias(nome, cor)").order("data_vencimento"),
        supabase.from("contas").select("*").eq("ativo", true),
      ]);
      if (l) setLancamentos(l);
      if (c) setContas(c);
    };
    fetchData();
  }, [user]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Monthly data for bar + line charts
  const monthlyData = useMemo(() => {
    const monthly: Record<string, { receitas: number; despesas: number }> = {};
    lancamentos.forEach(l => {
      const month = l.data_vencimento.substring(0, 7);
      if (!monthly[month]) monthly[month] = { receitas: 0, despesas: 0 };
      if (l.tipo === "receita") monthly[month].receitas += Number(l.valor);
      else monthly[month].despesas += Number(l.valor);
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        mes: month,
        receitas: data.receitas,
        despesas: data.despesas,
        saldo: data.receitas - data.despesas,
      }));
  }, [lancamentos]);

  // Current month lancamentos
  const mesLancamentos = useMemo(() => {
    const prefix = `${anoView}-${String(mesView).padStart(2, "0")}`;
    return lancamentos.filter(l => l.data_vencimento.startsWith(prefix));
  }, [lancamentos, mesView, anoView]);

  // Category pie data for selected month
  const categoryPieData = useMemo(() => {
    const cats: Record<string, { nome: string; valor: number; cor: string }> = {};
    mesLancamentos.filter(l => l.tipo === "despesa").forEach(l => {
      const name = l.categorias?.nome || "Sem categoria";
      const cor = l.categorias?.cor || "#6b7280";
      if (!cats[name]) cats[name] = { nome: name, valor: 0, cor };
      cats[name].valor += Number(l.valor);
    });
    return Object.values(cats).sort((a, b) => b.valor - a.valor);
  }, [mesLancamentos]);

  const receitaPieData = useMemo(() => {
    const cats: Record<string, { nome: string; valor: number; cor: string }> = {};
    mesLancamentos.filter(l => l.tipo === "receita").forEach(l => {
      const name = l.categorias?.nome || "Sem categoria";
      const cor = l.categorias?.cor || "#10b981";
      if (!cats[name]) cats[name] = { nome: name, valor: 0, cor };
      cats[name].valor += Number(l.valor);
    });
    return Object.values(cats).sort((a, b) => b.valor - a.valor);
  }, [mesLancamentos]);

  // Month summary
  const mesSummary = useMemo(() => {
    const rec = mesLancamentos.filter(l => l.tipo === "receita").reduce((a, l) => a + Number(l.valor), 0);
    const desp = mesLancamentos.filter(l => l.tipo === "despesa").reduce((a, l) => a + Number(l.valor), 0);
    return { receitas: rec, despesas: desp, saldo: rec - desp };
  }, [mesLancamentos]);

  // Top 5 expenses
  const topDespesas = useMemo(() => {
    const despesas = mesLancamentos.filter(l => l.tipo === "despesa").sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 5);
    const total = mesLancamentos.filter(l => l.tipo === "despesa").reduce((a, l) => a + Number(l.valor), 0);
    return despesas.map(d => ({ ...d, pct: total > 0 ? (Number(d.valor) / total) * 100 : 0 }));
  }, [mesLancamentos]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">📊 Relatórios</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={mesAnterior}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" className="min-w-[140px]">
              {dateHelper.nomeMes(mesView)} {anoView}
            </Button>
            <Button variant="outline" size="icon" onClick={mesProximo}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Month summary cards */}
        <div className="grid gap-4 grid-cols-3">
          <Card className="bg-success/5">
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Receitas</p>
              <p className="text-lg font-bold text-success">{formatCurrency(mesSummary.receitas)}</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5">
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Despesas</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(mesSummary.despesas)}</p>
            </CardContent>
          </Card>
          <Card className={mesSummary.saldo >= 0 ? "bg-success/5" : "bg-destructive/5"}>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Saldo</p>
              <p className={`text-lg font-bold ${mesSummary.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(mesSummary.saldo)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Evolution line chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📈 Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="receitas" stroke="#10b981" name="Receitas" strokeWidth={2} />
                  <Line type="monotone" dataKey="despesas" stroke="#ef4444" name="Despesas" strokeWidth={2} />
                  <Line type="monotone" dataKey="saldo" stroke="#3b82f6" name="Saldo" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Receitas vs Despesas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="receitas" fill="#10b981" name="Receitas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie charts + Top 5 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Despesas pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🔴 Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryPieData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem despesas neste mês.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryPieData} cx="50%" cy="50%" outerRadius={80} dataKey="valor" nameKey="nome">
                        {categoryPieData.map((entry, i) => (
                          <Cell key={entry.nome} fill={entry.cor || COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {categoryPieData.map((c, i) => {
                      const total = categoryPieData.reduce((s, x) => s + x.valor, 0);
                      const pct = total > 0 ? ((c.valor / total) * 100).toFixed(1) : "0";
                      return (
                        <div key={c.nome} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor || COLORS[i % COLORS.length] }} />
                            <span className="truncate">{c.nome}</span>
                          </div>
                          <span className="font-medium">{pct}% · {formatCurrency(c.valor)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Receitas pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🟢 Receitas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {receitaPieData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem receitas neste mês.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={receitaPieData} cx="50%" cy="50%" outerRadius={80} dataKey="valor" nameKey="nome">
                        {receitaPieData.map((entry, i) => (
                          <Cell key={entry.nome} fill={entry.cor || COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {receitaPieData.map((c, i) => {
                      const total = receitaPieData.reduce((s, x) => s + x.valor, 0);
                      const pct = total > 0 ? ((c.valor / total) * 100).toFixed(1) : "0";
                      return (
                        <div key={c.nome} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor || COLORS[i % COLORS.length] }} />
                            <span className="truncate">{c.nome}</span>
                          </div>
                          <span className="font-medium">{pct}% · {formatCurrency(c.valor)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top 5 despesas */}
        {topDespesas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🔝 Top 5 Maiores Despesas — {dateHelper.nomeMes(mesView)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topDespesas.map((d, i) => (
                <div key={d.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate">{i + 1}. {d.descricao}</span>
                    <span className="font-medium shrink-0">{formatCurrency(Number(d.valor))}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${d.pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{d.pct.toFixed(1)}% do total</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Relatorios;
