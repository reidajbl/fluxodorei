import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { TrendingUp, TrendingDown, Wallet, Target, ChevronLeft, ChevronRight, Plus, Minus, AlertTriangle, RefreshCw, BarChart3, Search } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import { gerarFixasParaMes } from "@/lib/gerarFixas";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

type Filtro = "todos" | "a_vencer" | "vencidos" | "pagos" | "recebidos";

const TABS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "a_vencer", label: "A Vencer" },
  { key: "vencidos", label: "Vencidos" },
  { key: "pagos", label: "Pagos" },
  { key: "recebidos", label: "Recebidos" },
];

function getStatusInfo(l: any) {
  const hoje = dateHelper.hojeStr();
  if (l.status === "pago" || l.data_pagamento) {
    if (l.tipo === "receita") return { label: "RECEBIDO", emoji: "✅", cls: "bg-success/10 text-success" };
    return { label: "PAGO", emoji: "✅", cls: "bg-success/10 text-success" };
  }
  if (l.data_vencimento < hoje) return { label: "VENCIDO", emoji: "🔴", cls: "bg-destructive/10 text-destructive" };
  return { label: "A VENCER", emoji: "🟡", cls: "bg-warning/10 text-warning" };
}

const Dashboard = () => {
  const { user } = useAuth();
  const { updateTrigger, forceUpdate } = useDashboard();
  const navigate = useNavigate();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [allLancamentos, setAllLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

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

  const refetchAll = useCallback(async () => {
    if (!user) return;
    await gerarFixasParaMes(anoView, mesView);
    await refetch();
  }, [user, mesView, anoView]);

  // Initial fetch + on month change + on global update trigger
  useEffect(() => {
    refetchAll();
  }, [refetchAll, updateTrigger]);

  // Realtime subscription for lancamentos changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dashboard-lancamentos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Refetch on window focus (e.g. returning from Lancamentos page)
  useEffect(() => {
    const onFocus = () => { refetchAll(); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [refetchAll]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Saldo real por conta: saldo_inicial + receitas pagas - despesas pagas
  const saldoRealPorConta = useMemo(() => {
    const result: Record<string, { nome: string; saldo: number; icone: string; cor: string }> = {};
    for (const conta of contas) {
      let saldo = Number(conta.saldo_inicial || 0);
      const lancConta = allLancamentos.filter(l => l.conta_id === conta.id && l.status === "pago");
      const receitas = lancConta.filter(l => l.tipo === "receita").reduce((acc, l) => acc + Number(l.valor), 0);
      const despesas = lancConta.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
      saldo = saldo + receitas - despesas;
      result[conta.id] = { nome: conta.nome, saldo, icone: conta.icone || "💰", cor: conta.cor || "#3b82f6" };
    }
    return result;
  }, [contas, allLancamentos]);

  const resumo = useMemo(() => {
    const receitasPendentes = lancamentos.filter(l => l.tipo === "receita" && l.status !== "pago");
    const despesasPendentes = lancamentos.filter(l => l.tipo === "despesa" && l.status !== "pago");
    const aReceber = receitasPendentes.reduce((acc, l) => acc + Number(l.valor), 0);
    const aPagar = despesasPendentes.reduce((acc, l) => acc + Number(l.valor), 0);
    const totalContas = Object.values(saldoRealPorConta).reduce((acc, c) => acc + c.saldo, 0);
    const despesasMes = lancamentos.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
    const projecao = totalContas - aPagar;
    return {
      aReceber, aPagar, totalContas, projecao,
      countReceitas: receitasPendentes.length,
      countDespesas: despesasPendentes.length,
      despesasMes,
    };
  }, [lancamentos, saldoRealPorConta]);

  // Projections 30/60/90 days

  // Top 5 expenses
  const topDespesas = useMemo(() => {
    const despesas = lancamentos.filter(l => l.tipo === "despesa").sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 5);
    const total = lancamentos.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
    return despesas.map(d => ({ ...d, pct: total > 0 ? (Number(d.valor) / total) * 100 : 0 }));
  }, [lancamentos]);

  // Apply filters (same logic as Lancamentos page)
  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (busca && !l.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      const status = getStatusInfo(l);
      if (filtro === "a_vencer") return status.label === "A VENCER";
      if (filtro === "vencidos") return status.label === "VENCIDO";
      if (filtro === "pagos") return l.tipo === "despesa" && status.label === "PAGO";
      if (filtro === "recebidos") return l.tipo === "receita" && status.label === "RECEBIDO";
      return true;
    });
  }, [lancamentos, filtro, busca]);

  // Group filtered lancamentos by date
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach(l => {
      const d = l.data_vencimento;
      if (!groups[d]) groups[d] = [];
      groups[d].push(l);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

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
              <Button variant="outline" size="sm" onClick={() => { forceUpdate(); toast.success("Dashboard atualizado!"); }} className="ml-2">
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
              </Button>
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
              <p className="text-xs text-muted-foreground">Saldo real ({contas.length} conta(s))</p>
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

        {/* Saldo por Conta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💰 Saldo por Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(saldoRealPorConta).map((conta) => (
                <div key={conta.nome} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span>{conta.icone}</span>
                    <span className="font-medium text-sm">{conta.nome}</span>
                  </div>
                  <span className={`font-bold text-sm ${conta.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(conta.saldo)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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


          {/* Main grid: Lancamentos + Sidebar */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lancamentos grouped by date */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                📋 Lançamentos — {dateHelper.nomeMes(mesView)} {anoView}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {TABS.map(t => (
                  <Button key={t.key} variant={filtro === t.key ? "default" : "outline"} size="sm"
                    onClick={() => setFiltro(t.key)} className="text-xs">
                    {t.label}
                  </Button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar lançamento..." value={busca} onChange={e => setBusca(e.target.value)}
                  className="pl-9" />
              </div>

              {grouped.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhum lançamento encontrado.</p>
              ) : (
                <div className="space-y-4">
                  {grouped.map(([date, items]) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        {date === dateHelper.hojeStr() ? "📌 HOJE — " : ""}{dateHelper.formatarDataCompleta(date)}
                      </p>
                      <div className="space-y-1">
                        {items.map((l: any) => {
                          const st = getStatusInfo(l);
                          return (
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
                                <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                                  {st.emoji} {st.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
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
