import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Share2, Copy, Check } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import { toast } from "@/components/ui/sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];

const Relatorios = () => {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [copiado, setCopiado] = useState(false);

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
  const mesHoje = () => { setMesView(mesAtual); setAnoView(anoAtual); };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: l }, { data: c }] = await Promise.all([
        supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome)").order("data_vencimento"),
        supabase.from("contas").select("*").eq("ativo", true),
      ]);
      if (l) setLancamentos(l);
      if (c) setContas(c);
    };
    fetchData();
  }, [user]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const periodo = `${dateHelper.nomeMes(mesView)} ${anoView}`;
  const prefix = `${anoView}-${String(mesView).padStart(2, "0")}`;

  // Current month lancamentos
  const mesLancamentos = useMemo(() =>
    lancamentos.filter(l => l.data_vencimento.startsWith(prefix)),
    [lancamentos, prefix]);

  // Month summary
  const mesSummary = useMemo(() => {
    const rec = mesLancamentos.filter(l => l.tipo === "receita").reduce((a, l) => a + Number(l.valor), 0);
    const desp = mesLancamentos.filter(l => l.tipo === "despesa").reduce((a, l) => a + Number(l.valor), 0);
    const saldo = rec - desp;
    const margem = rec > 0 ? (saldo / rec) * 100 : 0;
    return { receitas: rec, despesas: desp, saldo, margem };
  }, [mesLancamentos]);

  // Daily evolution (accumulated)
  const dailyData = useMemo(() => {
    const ultimoDia = new Date(anoView, mesView, 0).getDate();
    let acumulado = 0;
    const dados = [];
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const dataStr = dateHelper.criarDataSegura(anoView, mesView, dia);
      const doDia = mesLancamentos.filter(l => l.data_vencimento === dataStr);
      const rec = doDia.filter(l => l.tipo === "receita").reduce((a, l) => a + Number(l.valor), 0);
      const desp = doDia.filter(l => l.tipo === "despesa").reduce((a, l) => a + Number(l.valor), 0);
      acumulado += rec - desp;
      dados.push({ dia, saldo: acumulado, receitas: rec, despesas: desp });
    }
    return dados;
  }, [mesLancamentos, anoView, mesView]);

  // Category pie data
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

  // Top 10 expenses
  const topDespesas = useMemo(() => {
    const despesas = mesLancamentos.filter(l => l.tipo === "despesa").sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 10);
    const total = mesLancamentos.filter(l => l.tipo === "despesa").reduce((a, l) => a + Number(l.valor), 0);
    return despesas.map(d => ({ ...d, pct: total > 0 ? (Number(d.valor) / total) * 100 : 0 }));
  }, [mesLancamentos]);

  // Monthly comparison data (all months)
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
        label: month.substring(5, 7) + "/" + month.substring(2, 4),
        receitas: data.receitas,
        despesas: data.despesas,
        saldo: data.receitas - data.despesas,
      }));
  }, [lancamentos]);

  // Comparativo mensal table (last 6 months)
  const comparativo = useMemo(() => {
    const last6 = monthlyData.slice(-6);
    return last6.map((m, i) => {
      const prev = i > 0 ? last6[i - 1] : null;
      const varSaldo = prev && prev.saldo !== 0 ? ((m.saldo - prev.saldo) / Math.abs(prev.saldo)) * 100 : null;
      return { ...m, varSaldo };
    });
  }, [monthlyData]);

  // ─── Export CSV ───
  const exportarCSV = () => {
    const header = "Data,Descrição,Categoria,Conta,Tipo,Valor,Status,Observações";
    const rows = mesLancamentos.map(l =>
      [
        l.data_vencimento,
        `"${l.descricao}"`,
        `"${l.categorias?.nome || ""}"`,
        `"${l.contas?.nome || ""}"`,
        l.tipo,
        Number(l.valor).toFixed(2),
        l.status || "",
        `"${l.observacoes || ""}"`,
      ].join(",")
    ).join("\n");
    const csv = `${header}\n${rows}`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fluxo_rei_jbl_${prefix}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado com sucesso!");
  };

  // ─── Export PDF ───
  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("FLUXO REI DA JBL", 14, 20);
    doc.setFontSize(11);
    doc.text(`Relatório — ${periodo}`, 14, 28);
    doc.setFontSize(9);
    doc.text(`Receitas: ${formatCurrency(mesSummary.receitas)}`, 14, 40);
    doc.text(`Despesas: ${formatCurrency(mesSummary.despesas)}`, 14, 46);
    doc.text(`Saldo: ${formatCurrency(mesSummary.saldo)}`, 14, 52);
    doc.text(`Margem: ${mesSummary.margem.toFixed(1)}%`, 14, 58);

    const tableData = mesLancamentos.map(l => [
      dateHelper.formatarParaExibicao(l.data_vencimento),
      l.descricao,
      l.categorias?.nome || "-",
      l.contas?.nome || "-",
      l.tipo === "receita" ? "+" : "-",
      formatCurrency(Number(l.valor)),
      l.status === "pago" ? "Pago" : "Pendente",
    ]);

    autoTable(doc, {
      head: [["Data", "Descrição", "Categoria", "Conta", "Tipo", "Valor", "Status"]],
      body: tableData,
      startY: 65,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`fluxo_rei_jbl_${prefix}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  // ─── Share (copy to clipboard) ───
  const compartilhar = async () => {
    const topDesp = mesLancamentos
      .filter(l => l.tipo === "despesa")
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5)
      .map(l => `  • ${l.descricao}: ${formatCurrency(Number(l.valor))}`)
      .join("\n");

    const texto = `📊 FLUXO REI DA JBL — ${periodo}

💰 Receitas: ${formatCurrency(mesSummary.receitas)}
💸 Despesas: ${formatCurrency(mesSummary.despesas)}
💵 Saldo: ${formatCurrency(mesSummary.saldo)}
📊 Margem: ${mesSummary.margem.toFixed(1)}%

📋 Top despesas:
${topDesp}

🔗 Gerado pelo FLUXO REI JBL`;

    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success("Relatório copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
  const fim = dateHelper.ultimoDiaMes(anoView, mesView);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header + period + export */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h1 className="text-xl font-bold text-center">📊 Relatórios</h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={mesAnterior}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={mesHoje} className="min-w-[140px]">{periodo}</Button>
              <Button variant="outline" size="icon" onClick={mesProximo}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="text-xs text-muted-foreground">
              📆 {dateHelper.formatarParaExibicao(inicio)} — {dateHelper.formatarParaExibicao(fim)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={exportarPDF}>
              <Download className="h-4 w-4 mr-1" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={compartilhar}>
              {copiado ? <Check className="h-4 w-4 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
              {copiado ? "Copiado!" : "Compartilhar"}
            </Button>
          </div>
        </div>

        {/* Month summary cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">💰 Receitas</p>
              <p className="text-lg font-bold text-success">{formatCurrency(mesSummary.receitas)}</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">💸 Despesas</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(mesSummary.despesas)}</p>
            </CardContent>
          </Card>
          <Card className={mesSummary.saldo >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">💵 Saldo</p>
              <p className={`text-lg font-bold ${mesSummary.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(mesSummary.saldo)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">📊 Margem</p>
              <p className={`text-lg font-bold ${mesSummary.margem >= 0 ? "text-success" : "text-destructive"}`}>
                {mesSummary.margem.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Daily accumulated evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📈 Evolução Diária Acumulada — {periodo}</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dia" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={d => `Dia ${d}`} />
                  <Area type="monotone" dataKey="saldo" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Saldo Acumulado" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie charts grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Despesas pie */}
          <Card>
            <CardHeader><CardTitle className="text-base">🔴 Despesas por Categoria</CardTitle></CardHeader>
            <CardContent>
              {categoryPieData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem despesas.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryPieData} cx="50%" cy="50%" outerRadius={80} dataKey="valor" nameKey="nome">
                        {categoryPieData.map((e, i) => <Cell key={e.nome} fill={e.cor || COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
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
            <CardHeader><CardTitle className="text-base">🟢 Receitas por Categoria</CardTitle></CardHeader>
            <CardContent>
              {receitaPieData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Sem receitas.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={receitaPieData} cx="50%" cy="50%" outerRadius={80} dataKey="valor" nameKey="nome">
                        {receitaPieData.map((e, i) => <Cell key={e.nome} fill={e.cor || COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
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

        {/* Top 10 expenses */}
        {topDespesas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🔝 Top 10 Maiores Despesas — {periodo}</CardTitle>
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

        {/* Evolution line chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">📈 Evolução Mensal</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
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
          <CardHeader><CardTitle className="text-base">📊 Receitas vs Despesas por Mês</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
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

        {/* Comparativo mensal table */}
        {comparativo.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">📅 Comparativo Mensal</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Mês</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Receitas</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Despesas</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Saldo</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.map(m => (
                      <tr key={m.mes} className="border-b border-border/50">
                        <td className="py-2 font-medium">{m.label}</td>
                        <td className="text-right text-success">{formatCurrency(m.receitas)}</td>
                        <td className="text-right text-destructive">{formatCurrency(m.despesas)}</td>
                        <td className={`text-right font-medium ${m.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(m.saldo)}
                        </td>
                        <td className={`text-right text-xs ${m.varSaldo !== null ? (m.varSaldo >= 0 ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>
                          {m.varSaldo !== null ? `${m.varSaldo > 0 ? "▲" : "▼"} ${Math.abs(m.varSaldo).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conciliação de Caixa */}
        {contas.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">🔍 Conciliação de Caixa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {contas.map(conta => {
                const saldoInicial = Number(conta.saldo_inicial || 0);
                const lancConta = lancamentos.filter(l => l.conta_id === conta.id && (l.status === "pago" || !!l.data_pagamento));
                const entradas = lancConta.filter(l => l.tipo === "receita").reduce((a, l) => a + Number(l.valor), 0);
                const saidas = lancConta.filter(l => l.tipo === "despesa").reduce((a, l) => a + Number(l.valor), 0);
                const saldoEsperado = saldoInicial + entradas - saidas;
                // We don't have a "saldo_atual" field, so just show the calculation
                return (
                  <div key={conta.id} className="p-4 rounded-lg border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{conta.icone || "💰"}</span>
                      <span className="font-semibold">{conta.nome}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Saldo Inicial:</div>
                      <div className="text-right font-medium">{formatCurrency(saldoInicial)}</div>
                      <div className="text-muted-foreground">+ Entradas (pagas):</div>
                      <div className="text-right font-medium text-success">{formatCurrency(entradas)}</div>
                      <div className="text-muted-foreground">- Saídas (pagas):</div>
                      <div className="text-right font-medium text-destructive">{formatCurrency(saidas)}</div>
                      <div className="border-t border-border pt-1 font-semibold">= Saldo Calculado:</div>
                      <div className={`border-t border-border pt-1 text-right font-bold ${saldoEsperado >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(saldoEsperado)}
                      </div>
                    </div>
                    {saldoEsperado < 0 && (
                      <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-xs text-destructive">
                        <span>⚠️</span>
                        <span>Saldo negativo! Possíveis causas: lançamento duplicado, despesa não registrada ou saldo inicial incorreto. Use "🔧 Ajustar" na tela de Contas.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Relatorios;
