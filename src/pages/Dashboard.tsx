import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { TrendingUp, TrendingDown, Wallet, Target, ChevronLeft, ChevronRight, Plus, Minus, Zap, AlertTriangle, RefreshCw, BarChart3 } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import { gerarFixasParaMes } from "@/lib/gerarFixas";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
    const receitasMes = lancamentos.filter(l => l.tipo === "receita").reduce((acc, l) => acc + Number(l.valor), 0);
    const despesasMes = lancamentos.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
    const projecao = totalContas + receitasMes - despesasMes;
    return {
      aReceber, aPagar, totalContas, projecao,
      countReceitas: receitasPendentes.length,
      countDespesas: despesasPendentes.length,
      despesasMes,
    };
  }, [lancamentos, contas]);

  // Projections 30/60/90 days
  const projecoes = useMemo(() => {
    const hoje = dateHelper.hojeStr();
    const totalContas = contas.reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);
    const calcProj = (dias: number) => {
      const target = new Date();
      target.setDate(target.getDate() + dias);
      const targetStr = dateHelper.criarDataSegura(target.getFullYear(), target.getMonth() + 1, target.getDate());
      const receitas = allLancamentos.filter(l => l.tipo === "receita" && l.data_vencimento >= hoje && l.data_vencimento <= targetStr)
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const despesas = allLancamentos.filter(l => l.tipo === "despesa" && l.data_vencimento >= hoje && l.data_vencimento <= targetStr)
        .reduce((acc, l) => acc + Number(l.valor), 0);
      return totalContas + receitas - despesas;
    };
    return { d30: calcProj(30), d60: calcProj(60), d90: calcProj(90) };
  }, [allLancamentos, contas]);

  // Top 5 expenses
  const topDespesas = useMemo(() => {
    const despesas = lancamentos.filter(l => l.tipo === "despesa").sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 5);
    const total = lancamentos.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
    return despesas.map(d => ({ ...d, pct: total > 0 ? (Number(d.valor) / total) * 100 : 0 }));
  }, [lancamentos]);

  // Group lancamentos by date
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    lancamentos.forEach(l => {
      const d = l.data_vencimento;
      if (!groups[d]) groups[d] = [];
      groups[d].push(l);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [lancamentos]);

  // Category pie data
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

  // Category breakdown for receitas
  const receitaCats = useMemo(() => {
    const cats: Record<string, { nome: string; valor: number }> = {};
    lancamentos.filter(l => l.tipo === "receita").forEach(l => {
      const name = l.categorias?.nome || "Outros";
      if (!cats[name]) cats[name] = { nome: name, valor: 0 };
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={mesAnterior}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={mesAtualBtn} className="min-w-[140px]">
                {dateHelper.nomeMes(mesView)} {anoView}
              </Button>
              <Button variant="outline" size="icon" onClick={mesProximo}><ChevronRight className="h-4 w-4" /></Button>
            </div>
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
                  Seu saldo de {formatCurrency(resumo.totalContas)} não será suficiente para as despesas de {formatCurrency(resumo.despesasMes)} deste mês.
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
          <Button className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => navigate("/lancamentos")}>
            <Plus className="h-4 w-4 mr-2" />Receita
          </Button>
          <Button variant="destructive" onClick={() => navigate("/lancamentos")}>
            <Minus className="h-4 w-4 mr-2" />Despesa
          </Button>
          <Button variant="outline" onClick={() => navigate("/despesas-fixas")}>
            <RefreshCw className="h-4 w-4 mr-2" />Fixas
          </Button>
          <Button variant="outline" onClick={() => navigate("/relatorios")}>
            <BarChart3 className="h-4 w-4 mr-2" />Relatórios
          </Button>
        </div>

        {/* Projections 30/60/90 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📈 Projeções Futuras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "30 dias", value: projecoes.d30 },
                { label: "60 dias", value: projecoes.d60 },
                { label: "90 dias", value: projecoes.d90 },
              ].map(p => (
                <div key={p.label} className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">{p.label}</p>
                  <p className={`text-lg font-bold ${p.value >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(p.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main grid: Lancamentos + Sidebar */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lancamentos grouped by date */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                📋 Lançamentos — {dateHelper.nomeMes(mesView)} {anoView}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {grouped.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhum lançamento neste mês.</p>
              ) : (
                <div className="space-y-4">
                  {grouped.map(([date, items]) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        {date === dateHelper.hojeStr() ? "📌 HOJE — " : ""}{dateHelper.formatarDataCompleta(date)}
                      </p>
                      <div className="space-y-1">
                        {items.map((l: any) => (
                          <div key={l.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-base shrink-0">{l.contas?.icone || "💰"}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-sm truncate">{l.descricao}</p>
                                  {l.observacoes?.includes("🔄 Fixa:") && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">🔄</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{l.categorias?.nome} · {l.contas?.nome || ""}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-semibold text-sm ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                                {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "pago" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                                {l.status === "pago" ? "✅" : "⏳"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar: Category charts + Top 5 */}
          <div className="space-y-6">
            {/* Pie chart despesas */}
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

            {/* Receitas breakdown */}
            {receitaCats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-success">💰 Receitas por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receitaCats.map(c => (
                    <div key={c.nome}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="truncate">{c.nome}</span>
                        <span className="text-muted-foreground">{c.pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Top 5 expenses */}
            {topDespesas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">🔝 Top 5 Despesas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topDespesas.map((d, i) => (
                    <div key={d.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="truncate">{i + 1}. {d.descricao}</span>
                        <span className="font-medium">{formatCurrency(Number(d.valor))}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${d.pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{d.pct.toFixed(1)}% do total</p>
                    </div>
                  ))}
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
