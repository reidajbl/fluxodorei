import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { TrendingUp, TrendingDown, Wallet, Target, ChevronLeft, ChevronRight, Plus, Minus, Zap } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import { gerarFixasParaMes } from "@/lib/gerarFixas";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

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
  const mesAtualBtn = () => { setMesView(mesAtual); setAnoView(anoAtual); };

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
      const fim = dateHelper.ultimoDiaMes(anoView, mesView);

      // Auto-generate fixas for the viewed month
      await gerarFixasParaMes(anoView, mesView);

      const [{ data: l }, { data: c }, { data: cat }] = await Promise.all([
        supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome, icone)")
          .gte("data_vencimento", inicio).lte("data_vencimento", fim)
          .order("data_vencimento", { ascending: false }),
        supabase.from("contas").select("*").eq("ativo", true),
        supabase.from("categorias").select("*"),
      ]);
      if (l) setLancamentos(l);
      if (c) setContas(c);
      if (cat) setCategorias(cat);
    };
    fetchAll();
  }, [user, mesView, anoView]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const resumo = useMemo(() => {
    const aReceber = lancamentos
      .filter(l => l.tipo === "receita" && l.status !== "pago")
      .reduce((acc, l) => acc + Number(l.valor), 0);
    const aPagar = lancamentos
      .filter(l => l.tipo === "despesa" && l.status !== "pago")
      .reduce((acc, l) => acc + Number(l.valor), 0);
    const totalContas = contas.reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);
    const receitasMes = lancamentos.filter(l => l.tipo === "receita").reduce((acc, l) => acc + Number(l.valor), 0);
    const despesasMes = lancamentos.filter(l => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
    const projecao = totalContas + receitasMes - despesasMes;
    return { aReceber, aPagar, totalContas, projecao };
  }, [lancamentos, contas]);

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

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const receitaCats: Record<string, { nome: string; valor: number }> = {};
    const despesaCats: Record<string, { nome: string; valor: number }> = {};
    lancamentos.forEach(l => {
      const catName = l.categorias?.nome || "Outros";
      const target = l.tipo === "receita" ? receitaCats : despesaCats;
      if (!target[catName]) target[catName] = { nome: catName, valor: 0 };
      target[catName].valor += Number(l.valor);
    });
    const toPercent = (cats: Record<string, { nome: string; valor: number }>) => {
      const arr = Object.values(cats).sort((a, b) => b.valor - a.valor);
      const total = arr.reduce((s, c) => s + c.valor, 0);
      return arr.map(c => ({ ...c, pct: total > 0 ? (c.valor / total) * 100 : 0 }));
    };
    return { receitas: toPercent(receitaCats), despesas: toPercent(despesaCats) };
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
              <Button variant="outline" size="icon" onClick={mesAnterior}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={mesAtualBtn} className="min-w-[140px]">
                {dateHelper.nomeMes(mesView)} {anoView}
              </Button>
              <Button variant="outline" size="icon" onClick={mesProximo}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {dateHelper.formatarParaExibicao(inicio)} — {dateHelper.formatarParaExibicao(fim)}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">A Receber</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-success">{formatCurrency(resumo.aReceber)}</div>
              <p className="text-xs text-muted-foreground">Receitas pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">A Pagar</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-destructive">{formatCurrency(resumo.aPagar)}</div>
              <p className="text-xs text-muted-foreground">Despesas pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Saldo Atual</CardTitle>
              <Wallet className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${resumo.totalContas >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumo.totalContas)}
              </div>
              <p className="text-xs text-muted-foreground">Total em contas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Projeção</CardTitle>
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
            <Plus className="h-4 w-4 mr-2" />Adicionar receita
          </Button>
          <Button variant="destructive" onClick={() => navigate("/lancamentos")}>
            <Minus className="h-4 w-4 mr-2" />Adicionar despesa
          </Button>
          <Button variant="outline" onClick={async () => {
            const n = await gerarFixasParaMes(anoView, mesView);
            if (n > 0) {
              toast.success(`${n} lançamento(s) fixo(s) gerado(s)!`);
              // Re-fetch
              const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
              const fim = dateHelper.ultimoDiaMes(anoView, mesView);
              const { data: l } = await supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome, icone)")
                .gte("data_vencimento", inicio).lte("data_vencimento", fim).order("data_vencimento", { ascending: false });
              if (l) setLancamentos(l);
            } else {
              toast.info("Nenhuma fixa pendente para gerar neste mês.");
            }
          }}>
            <Zap className="h-4 w-4 mr-2" />Gerar fixas do mês
          </Button>
        </div>

        {/* Main content: Lancamentos + Category chart */}
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
                        {dateHelper.formatarDataCompleta(date)}
                      </p>
                      <div className="space-y-1">
                        {items.map((l: any) => (
                          <div key={l.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-base shrink-0">{l.contas?.icone || "💰"}</span>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{l.descricao}</p>
                                <p className="text-xs text-muted-foreground">{l.categorias?.nome}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`font-semibold text-sm ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                                {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                l.status === "pago"
                                  ? "bg-success/10 text-success"
                                  : "bg-warning/10 text-warning"
                              }`}>
                                {l.status === "pago" ? "✅ Pago" : "⏳ A vencer"}
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

          {/* Category breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">📊 Por Categoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {categoryBreakdown.receitas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-success uppercase mb-2">Receitas</p>
                  <div className="space-y-2">
                    {categoryBreakdown.receitas.map(c => (
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
                  </div>
                </div>
              )}
              {categoryBreakdown.despesas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-destructive uppercase mb-2">Despesas</p>
                  <div className="space-y-2">
                    {categoryBreakdown.despesas.map(c => (
                      <div key={c.nome}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="truncate">{c.nome}</span>
                          <span className="text-muted-foreground">{c.pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {categoryBreakdown.receitas.length === 0 && categoryBreakdown.despesas.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">Sem dados neste mês.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
