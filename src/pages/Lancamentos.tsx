import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Minus, Trash2, Edit2, Settings, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import GerenciarCategorias from "@/components/GerenciarCategorias";

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

const Lancamentos = () => {
  const { user } = useAuth();
  const { forceUpdate } = useDashboard();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

  const { ano: anoAtual, mes: mesAtual } = dateHelper.mesAnoAtual();
  const [mesView, setMesView] = useState(mesAtual);
  const [anoView, setAnoView] = useState(anoAtual);

  const hoje = dateHelper.hojeStr();
  const [form, setForm] = useState({
    descricao: "", valor: "", tipo: "despesa", conta_id: "", categoria_id: "",
    data_vencimento: hoje, data_pagamento: "", jaPago: false, observacoes: "",
  });

  const mesAnterior = () => { if (mesView === 1) { setMesView(12); setAnoView(anoView - 1); } else setMesView(mesView - 1); };
  const mesProximo = () => { if (mesView === 12) { setMesView(1); setAnoView(anoView + 1); } else setMesView(mesView + 1); };

  const fetchData = async () => {
    if (!user) return;
    const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
    const fim = dateHelper.ultimoDiaMes(anoView, mesView);
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

  useEffect(() => { fetchData(); }, [user, mesView, anoView]);

  const resetForm = () => {
    setForm({ descricao: "", valor: "", tipo: "despesa", conta_id: "", categoria_id: "", data_vencimento: hoje, data_pagamento: "", jaPago: false, observacoes: "" });
    setEditingId(null);
  };

  const openNew = (tipo: string) => { resetForm(); setForm(f => ({ ...f, tipo })); setOpen(true); };

  const openEdit = (l: any) => {
    setEditingId(l.id);
    setForm({
      descricao: l.descricao, valor: String(l.valor), tipo: l.tipo, conta_id: l.conta_id,
      categoria_id: l.categoria_id || "", data_vencimento: l.data_vencimento,
      data_pagamento: l.data_pagamento || "", jaPago: l.status === "pago",
      observacoes: l.observacoes || "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.conta_id) { toast.error("Selecione uma conta"); return; }
    const payload = {
      descricao: form.descricao.trim(), valor: parseFloat(form.valor), tipo: form.tipo,
      conta_id: form.conta_id, categoria_id: form.categoria_id || null,
      data_vencimento: form.data_vencimento,
      data_pagamento: form.jaPago ? (form.data_pagamento || hoje) : null,
      status: form.jaPago ? "pago" : "a_vencer",
      observacoes: form.observacoes?.trim() || null, user_id: user.id,
    };
    let error;
    if (editingId) {
      const { user_id, ...upd } = payload;
      ({ error } = await supabase.from("lancamentos").update(upd).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("lancamentos").insert(payload));
    }
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else { toast.success(editingId ? "Atualizado!" : "Criado!"); setOpen(false); resetForm(); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("lancamentos").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluído!"); fetchData(); }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const filteredCategories = categorias.filter(c => c.tipo === form.tipo || c.tipo === "ambos");

  // Apply filters
  const filtered = lancamentos.filter(l => {
    if (busca && !l.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
    const status = getStatusInfo(l);
    if (filtro === "a_vencer") return status.label === "A VENCER";
    if (filtro === "vencidos") return status.label === "VENCIDO";
    if (filtro === "pagos") return l.tipo === "despesa" && status.label === "PAGO";
    if (filtro === "recebidos") return l.tipo === "receita" && status.label === "RECEBIDO";
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, any[]>>((acc, l) => {
    const d = l.data_vencimento;
    if (!acc[d]) acc[d] = [];
    acc[d].push(l);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">📋 Lançamentos</h1>
          <div className="flex gap-2">
            <Button className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => openNew("receita")}>
              <Plus className="h-4 w-4 mr-2" />Receita
            </Button>
            <Button variant="destructive" onClick={() => openNew("despesa")}>
              <Minus className="h-4 w-4 mr-2" />Despesa
            </Button>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={mesAnterior}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" className="min-w-[140px]" onClick={() => { setMesView(mesAtual); setAnoView(anoAtual); }}>
            {dateHelper.nomeMes(mesView)} {anoView}
          </Button>
          <Button variant="outline" size="icon" onClick={mesProximo}><ChevronRight className="h-4 w-4" /></Button>
        </div>

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

        {/* Dialog */}
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Lançamento" : form.tipo === "receita" ? "➕ Nova Receita" : "➖ Nova Despesa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3">
                <Button type="button" variant={form.tipo === "receita" ? "default" : "outline"} className={form.tipo === "receita" ? "bg-success hover:bg-success/90 flex-1" : "flex-1"} onClick={() => setForm({ ...form, tipo: "receita", categoria_id: "" })}>Receita</Button>
                <Button type="button" variant={form.tipo === "despesa" ? "destructive" : "outline"} className="flex-1" onClick={() => setForm({ ...form, tipo: "despesa", categoria_id: "" })}>Despesa</Button>
              </div>
              <div className="space-y-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} required maxLength={200} placeholder="Ex: Pagamento aluguel" /></div>
              <div className="space-y-2"><Label>Valor (R$) *</Label><Input type="number" step="0.01" min="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Data Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Conta *</Label>
                <Select value={form.conta_id} onValueChange={v => setForm({ ...form, conta_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Categoria</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setCatOpen(true)}><Settings className="h-3 w-3" /> Gerenciar</Button>
                </div>
                <Select value={form.categoria_id} onValueChange={v => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="jaPago" checked={form.jaPago} onCheckedChange={v => setForm({ ...form, jaPago: !!v, data_pagamento: v ? hoje : "" })} />
                <Label htmlFor="jaPago" className="cursor-pointer">Já foi pago/recebido?</Label>
              </div>
              {form.jaPago && <div className="space-y-2"><Label>Data Pagamento</Label><Input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} /></div>}
              <div className="space-y-2"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} maxLength={500} placeholder="Opcional" /></div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1">💾 Salvar</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); resetForm(); }}>❌ Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* List */}
        <Card>
          <CardContent className="p-0">
            {sortedDates.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">Nenhum lançamento encontrado.</p>
            ) : (
              <div className="divide-y divide-border">
                {sortedDates.map(date => (
                  <div key={date} className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      {date === hoje ? "📌 HOJE — " : ""}{dateHelper.formatarDataCompleta(date)}
                    </p>
                    <div className="space-y-1">
                      {grouped[date].map((l: any) => {
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
                                <p className="text-xs text-muted-foreground">{l.categorias?.nome} · {l.contas?.nome}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-semibold text-sm ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                                {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>
                                {st.emoji} {st.label}
                              </span>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(l.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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
        <GerenciarCategorias open={catOpen} onOpenChange={setCatOpen} onUpdate={fetchData} />
      </div>
    </DashboardLayout>
  );
};

export default Lancamentos;
