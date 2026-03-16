import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { TrendingUp, TrendingDown, Wallet, Target, ChevronLeft, ChevronRight, Plus, Minus, AlertTriangle, RefreshCw, Search } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import { gerarFixasParaMes } from "@/lib/gerarFixas";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import LancamentoFormDialog from "@/components/lancamentos/LancamentoFormDialog";
import LancamentosList from "@/components/lancamentos/LancamentosList";

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

type Filtro = "todos" | "a_vencer" | "vencidos" | "pagos" | "recebidos";

const TABS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "a_vencer", label: "A Vencer" },
  { key: "vencidos", label: "Vencidos" },
  { key: "pagos", label: "Pagos" },
  { key: "recebidos", label: "Recebidos" },
];

const Dashboard = () => {
  const { user } = useAuth();
  const { updateTrigger, forceUpdate } = useDashboard();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [allLancamentos, setAllLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

  // Form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<any | null>(null);
  const [defaultTipo, setDefaultTipo] = useState("despesa");

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
    const [{ data: l }, { data: c }, { data: all }] = await Promise.all([
      supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome, icone)")
        .gte("data_vencimento", inicio).lte("data_vencimento", fim)
        .order("data_vencimento", { ascending: false }),
      supabase.from("contas").select("*").eq("ativo", true),
      supabase.from("lancamentos").select("*, categorias(nome, cor)")
        .order("data_vencimento", { ascending: true }),
    ]);
    if (l) setLancamentos(l);
    if (c) setContas(c);
    if (all) setAllLancamentos(all);
  };

  const refetchAll = useCallback(async () => {
    if (!user) return;
    await gerarFixasParaMes(anoView, mesView);
    await refetch();
  }, [user, mesView, anoView]);

  useEffect(() => { refetchAll(); }, [refetchAll, updateTrigger]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dashboard-lancamentos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const onFocus = () => { refetchAll(); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [refetchAll]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

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
    return { aReceber, aPagar, totalContas, projecao, countReceitas: receitasPendentes.length, countDespesas: despesasPendentes.length, despesasMes };
  }, [lancamentos, saldoRealPorConta]);

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

  const topDespesas = useMemo(() => {
    const despesas = lancamentos.filter(l => l.tipo === "despesa").sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 5);
    const total = lancamentos.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
    return despesas.map(d => ({ ...d, pct: total > 0 ? (Number(d.valor) / total) * 100 : 0 }));
  }, [lancamentos]);

  const openNew = (tipo: string) => {
    setEditingLancamento(null);
    setDefaultTipo(tipo);
    setDialogOpen(true);
  };

  const openEdit = (l: any) => {
    setEditingLancamento(l);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    refetchAll();
    forceUpdate();
  };

  const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
  const fim = dateHelper.ultimoDiaMes(anoView, mesView);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen overflow-hidden -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8">
        {/* Fixed top section */}
        <div className="flex-none space-y-4 overflow-hidden">
        {/* Header */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h1 className="text-xl font-bold text-center">FLUXO REI DA JBL</h1>
          <p className="text-sm text-muted-foreground text-center">Controle financeiro simples</p>
          <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
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
          <div className="p-3 bg-destructive/10 border-l-4 border-destructive rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-destructive text-xs">🚨 PROJEÇÃO NEGATIVA — Déficit: {formatCurrency(Math.abs(resumo.projecao))}</h4>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setAlertDismissed(true)}>✕</Button>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">💰 A Receber</span>
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              </div>
              <div className="text-base font-bold text-success">{formatCurrency(resumo.aReceber)}</div>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">💸 A Pagar</span>
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              </div>
              <div className="text-base font-bold text-destructive">{formatCurrency(resumo.aPagar)}</div>
            </CardContent>
          </Card>
          <Card className="bg-info/5 border-info/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">💰 Total Contas</span>
                <Wallet className="h-3.5 w-3.5 text-info" />
              </div>
              <div className={`text-base font-bold ${resumo.totalContas >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumo.totalContas)}
              </div>
            </CardContent>
          </Card>
          <Card className={`${resumo.projecao >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">🔮 Projeção</span>
                <Target className="h-3.5 w-3.5 text-warning" />
              </div>
              <div className={`text-base font-bold ${resumo.projecao >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumo.projecao)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Saldo por Conta - compact */}
        <div className="flex flex-wrap gap-2">
          {Object.values(saldoRealPorConta).map((conta) => (
            <div key={conta.nome} className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-sm">
              <span>{conta.icone}</span>
              <span className="font-medium">{conta.nome}</span>
              <span className={`font-bold ${conta.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(conta.saldo)}
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons + Tabs + Search */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => openNew("receita")}>
            <Plus className="h-4 w-4 mr-1" />Receita
          </Button>
          <Button size="sm" variant="destructive" onClick={() => openNew("despesa")}>
            <Minus className="h-4 w-4 mr-1" />Despesa
          </Button>
          <div className="h-5 w-px bg-border mx-1" />
          {TABS.map(t => (
            <Button key={t.key} variant={filtro === t.key ? "default" : "outline"} size="sm"
              onClick={() => setFiltro(t.key)} className="text-xs h-7">
              {t.label}
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lançamento..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        </div>

        {/* Lancamento Form Dialog */}
        <LancamentoFormDialog
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingLancamento(null); }}
          editingLancamento={editingLancamento}
          defaultTipo={defaultTipo}
          onSaved={handleSaved}
        />

        {/* Scrollable lancamentos area */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-card">
          <div className="sticky top-0 bg-card z-10 px-4 py-2 border-b border-border">
            <span className="text-sm font-semibold">📋 Lançamentos — {dateHelper.nomeMes(mesView)} {anoView}</span>
          </div>
          <div className="p-4">
            <LancamentosList
              lancamentos={lancamentos}
              filtro={filtro}
              busca={busca}
              onEdit={openEdit}
              onDeleted={handleSaved}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
