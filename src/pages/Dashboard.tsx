import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { TrendingUp, TrendingDown, Wallet, Target, AlertTriangle, RefreshCw, BarChart3 } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import { gerarFixasParaMes } from "@/lib/gerarFixas";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import LancamentosLista, { getStatusInfo } from "@/components/LancamentosLista";

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [allLancamentos, setAllLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const { ano: anoAtual, mes: mesAtual } = dateHelper.mesAnoAtual();
  const [mesView, setMesView] = useState(mesAtual);
  const [anoView, setAnoView] = useState(anoAtual);

  const mesAnterior = () => {
    if (mesView === 1) { setMesView(12); setAnoView(anoView - 1); }
    else setMesView(mesView - 1);
    setAlertDismissed(false);
  };
  const mesProximo = () => {
    if (mesView === 12) { setMesView(1); setAnoView(anoView + 1); }
    else setMesView(mesView + 1);
    setAlertDismissed(false);
  };
  const mesAtualBtn = () => { setMesView(mesAtual); setAnoView(anoAtual); setAlertDismissed(false); };

  const refetch = async () => {
    const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
    const fim = dateHelper.ultimoDiaMes(anoView, mesView);
    const [{ data: l }, { data: c }, { data: cat }, { data: all }] = await Promise.all([
      supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome, icone)")
        .gte("data_vencimento", inicio).lte("data_vencimento", fim)
        .order("data_vencimento", { ascending: false }),
      supabase.from("contas").select("*").eq("ativo", true),
      supabase.from("categorias").select("*"),
      supabase.from("lancamentos").select("*, categorias(nome, cor)")
        .order("data_vencimento", { ascending: true }),
    ]);
    if (l) setLancamentos(l);
    if (c) setContas(c);
    if (cat) setCategorias(cat);
    if (all) setAllLancamentos(all);
  };

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      await gerarFixasParaMes(anoView, mesView);
      await refetch();
    };
    fetchAll();
  }, [user, mesView, anoView]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const resumo = useMemo(() => {
    const receitasPendentes = lancamentos.filter(l => l.tipo === "receita" && l.status !== "pago");
    const despesasPendentes = lancamentos.filter(l => l.tipo === "despesa" && l.status !== "pago");
    const aReceber = receitasPendentes.reduce((acc, l) => acc + Number(l.valor), 0);
    const aPagar = despesasPendentes.reduce((acc, l) => acc + Number(l.valor), 0);
    const totalContas = contas.reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);
    const projecao = totalContas - aPagar; // PROJEÇÃO = TOTAL EM CONTAS - A PAGAR
    return { aReceber, aPagar, totalContas, projecao, countReceitas: receitasPendentes.length, countDespesas: despesasPendentes.length };
  }, [lancamentos, contas]);


  const categoryPieData = useMemo(() => {
    const cats: Record<string, { nome: string; valor: number; cor: string }> = {};
    lancamentos.filter(l => l.tipo === "despesa").forEach(l => {
      const name = l.categorias?.nome || "Outros";
      const cor = l.categorias?.cor || "#6b7280";
      if (!cats[name]) cats[name] = { nome: name, valor: 0, cor };
      cats[name].valor += Number(l.valor);
    });
    const arr = Object.values(cats).sort((a, b) => b.valor - a.valor);
    const total = arr.reduce((s, c) => s + c.valor, 0);
    return arr.map(c => ({ ...c, pct: total > 0 ? (c.valor / total) * 100 : 0 }));
  }, [lancamentos]);

  const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
  const fim = dateHelper.ultimoDiaMes(anoView, mesView);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h1 className="text-xl font-bold text-center">FLUXO REI DA JBL</h1>
          <p className="text-sm text-muted-foreground text-center">Controle financeiro simples</p>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="text-xs text-muted-foreground">
              {dateHelper.formatarParaExibicao(inicio)} — {dateHelper.formatarParaExibicao(fim)}
            </div>
          </div>
        </div>

        {/* Negative projection alert */}
        {resumo.projecao < 0 && !alertDismissed && (
          <div className="p-4 bg-destructive/10 border-l-4 border-destructive rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-destructive text-sm">🚨 ATENÇÃO: PROJEÇÃO NEGATIVA</h4>
                <p className="text-xs text-destructive/80 mt-1">
                  Seu saldo de {formatCurrency(resumo.totalContas)} não é suficiente para cobrir {formatCurrency(resumo.aPagar)} a pagar.
                </p>
                <p className="text-xs font-semibold text-destructive mt-1">
                  🔴 Déficit projetado: {formatCurrency(Math.abs(resumo.projecao))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">💡 Reduza despesas ou antecipe receitas.</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setAlertDismissed(true)}>✕</Button>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-success/5 border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">💰 A Receber</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-success">{formatCurrency(resumo.aReceber)}</div>
              <p className="text-xs text-muted-foreground">{resumo.countReceitas} receita(s) pendente(s)</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">💸 A Pagar</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-destructive">{formatCurrency(resumo.aPagar)}</div>
              <p className="text-xs text-muted-foreground">{resumo.countDespesas} despesa(s) pendente(s)</p>
            </CardContent>
          </Card>
          <Card className="bg-info/5 border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">💰 Total em Contas</CardTitle>
              <Wallet className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${resumo.totalContas >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumo.totalContas)}
              </div>
              <p className="text-xs text-muted-foreground">{contas.length} conta(s) ativa(s)</p>
            </CardContent>
          </Card>
          <Card className={`${resumo.projecao >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">🔮 Projeção</CardTitle>
              <Target className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${resumo.projecao >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumo.projecao)}
              </div>
              <p className="text-xs text-muted-foreground">Previsão do mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/despesas-fixas")}>
            <RefreshCw className="h-4 w-4 mr-2" />Fixas
          </Button>
          <Button variant="outline" onClick={() => navigate("/relatorios")}>
            <BarChart3 className="h-4 w-4 mr-2" />Relatórios
          </Button>
        </div>


        {/* Main grid: Lancamentos + Sidebar */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lancamentos - SAME component as Lancamentos page */}
          <div className="lg:col-span-2">
            <LancamentosLista
              lancamentos={lancamentos}
              contas={contas}
              categorias={categorias}
              mesView={mesView}
              anoView={anoView}
              onMesAnterior={mesAnterior}
              onMesProximo={mesProximo}
              onMesAtual={mesAtualBtn}
              onRefresh={refetch}
              showNewButtons={true}
            />
          </div>

          {/* Sidebar: Category chart */}
          <div className="space-y-6">
            {categoryPieData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">📊 Despesas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={categoryPieData} cx="50%" cy="50%" outerRadius={70} dataKey="valor" nameKey="nome">
                        {categoryPieData.map((entry, i) => (
                          <Cell key={entry.nome} fill={entry.cor || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {categoryPieData.map((c, i) => (
                      <div key={c.nome} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.cor || PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{c.nome}</span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <span className="text-muted-foreground">{c.pct.toFixed(1)}%</span>
                          <span className="font-medium">{formatCurrency(c.valor)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
