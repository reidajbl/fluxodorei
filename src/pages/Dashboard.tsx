import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDados } from "@/contexts/DadosContext";
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
import { calcularSaldoTodasContas } from "@/lib/saldoHelper";

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
  const { contas, lancamentos: allLancamentos, refresh, loading } = useDados();
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

  // Filter lancamentos for the selected month from cached data
  const lancamentos = useMemo(() => {
    const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
    const fim = dateHelper.ultimoDiaMes(anoView, mesView);
    return allLancamentos
      .filter(l => l.data_vencimento >= inicio && l.data_vencimento <= fim)
      .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));
  }, [allLancamentos, anoView, mesView]);

  // Generate fixed expenses for the month
  const refetchAll = useCallback(async () => {
    if (!user) return;
    await gerarFixasParaMes(anoView, mesView);
    await refresh();
  }, [user, mesView, anoView, refresh]);

  useEffect(() => { refetchAll(); }, [refetchAll, updateTrigger]);

  useEffect(() => {
    const onFocus = () => { refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const saldoRealPorConta = useMemo(() => {
    const { saldoPorConta } = calcularSaldoTodasContas(contas, allLancamentos);
    return saldoPorConta;
  }, [contas, allLancamentos]);

  const resumo = useMemo(() => {
    const isPago = (l: any) => l.status === "pago" || !!l.data_pagamento;
    const receitasPendentes = lancamentos.filter(l => l.tipo === "receita" && !isPago(l));
    const despesasPendentes = lancamentos.filter(l => l.tipo === "despesa" && !isPago(l));
    const aReceber = receitasPendentes.reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0);
    const aPagar = despesasPendentes.reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0);
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
    refresh();
    forceUpdate();
  };

  const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
  const fim = dateHelper.ultimoDiaMes(anoView, mesView);

  const bannerIndicators = [
    { label: "💰 A Receber", value: formatCurrency(resumo.aReceber) },
    { label: "💸 A Pagar", value: formatCurrency(resumo.aPagar) },
    { label: "💼 Total Contas", value: formatCurrency(resumo.totalContas) },
    { label: "🔮 Projeção", value: formatCurrency(resumo.projecao), variation: { value: resumo.projecao >= 0 ? "Positiva" : "Negativa", positive: resumo.projecao >= 0 } },
  ];

  const bannerRight = (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur" onClick={mesAnterior}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="sm" className="h-8 min-w-[120px] bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur" onClick={mesAtualBtn}>
        {dateHelper.nomeMes(mesView)} {anoView}
      </Button>
      <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur" onClick={mesProximo}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur"
        onClick={() => { refresh(); forceUpdate(); toast.success("Dashboard atualizado!"); }}>
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <DashboardLayout title="Visão geral deste mês" subtitle="Dashboard" indicators={bannerIndicators} bannerRight={bannerRight}>
      {resumo.projecao < 0 && !alertDismissed && (
        <div className="p-3 bg-destructive/10 border-l-4 border-destructive rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <h4 className="font-bold text-destructive text-xs flex-1">🚨 PROJEÇÃO NEGATIVA — Déficit: {formatCurrency(Math.abs(resumo.projecao))}</h4>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setAlertDismissed(true)}>✕</Button>
        </div>
      )}

      {/* Saldo por Conta */}
      <div className="flex flex-wrap gap-1.5">
        {Object.values(saldoRealPorConta).map((conta) => (
          <div key={conta.nome} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs shadow-sm">
            <span>{conta.icone}</span>
            <span className="font-medium">{conta.nome}</span>
            <span className={`font-bold ${conta.saldo >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(conta.saldo)}
            </span>
          </div>
        ))}
      </div>

      {/* Action + Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground shrink-0" onClick={() => openNew("receita")}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Receita</span>
        </Button>
        <Button size="sm" variant="destructive" className="shrink-0" onClick={() => openNew("despesa")}>
          <Minus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Despesa</span>
        </Button>
        <div className="h-5 w-px bg-border mx-1 shrink-0" />
        {TABS.map(t => (
          <Button key={t.key} variant={filtro === t.key ? "default" : "outline"} size="sm"
            onClick={() => setFiltro(t.key)} className="text-xs h-7 whitespace-nowrap shrink-0">
            {t.label}
          </Button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar lançamento..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      <LancamentoFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingLancamento(null); }}
        editingLancamento={editingLancamento}
        defaultTipo={defaultTipo}
        onSaved={handleSaved}
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
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
    </DashboardLayout>
  );
};

export default Dashboard;
