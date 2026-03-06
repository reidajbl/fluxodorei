import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Minus, Trash2, Edit2, Settings } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import GerenciarCategorias from "@/components/GerenciarCategorias";

const Lancamentos = () => {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const hoje = dateHelper.hojeStr();
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    tipo: "despesa",
    conta_id: "",
    categoria_id: "",
    data_vencimento: hoje,
    data_pagamento: "",
    jaPago: false,
    observacoes: "",
  });

  const fetchData = async () => {
    if (!user) return;
    const [{ data: l }, { data: c }, { data: cat }] = await Promise.all([
      supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome, icone)").order("data_vencimento", { ascending: false }),
      supabase.from("contas").select("*").eq("ativo", true),
      supabase.from("categorias").select("*"),
    ]);
    if (l) setLancamentos(l);
    if (c) setContas(c);
    if (cat) setCategorias(cat);
  };

  useEffect(() => { fetchData(); }, [user]);

  const resetForm = () => {
    setForm({ descricao: "", valor: "", tipo: "despesa", conta_id: "", categoria_id: "", data_vencimento: hoje, data_pagamento: "", jaPago: false, observacoes: "" });
    setEditingId(null);
  };

  const openNew = (tipo: string) => {
    resetForm();
    setForm(f => ({ ...f, tipo }));
    setOpen(true);
  };

  const openEdit = (l: any) => {
    setEditingId(l.id);
    setForm({
      descricao: l.descricao,
      valor: String(l.valor),
      tipo: l.tipo,
      conta_id: l.conta_id,
      categoria_id: l.categoria_id || "",
      data_vencimento: l.data_vencimento,
      data_pagamento: l.data_pagamento || "",
      jaPago: l.status === "pago",
      observacoes: l.observacoes || "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.conta_id) {
      toast.error("Selecione uma conta");
      return;
    }

    const payload = {
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor),
      tipo: form.tipo,
      conta_id: form.conta_id,
      categoria_id: form.categoria_id || null,
      data_vencimento: form.data_vencimento,
      data_pagamento: form.jaPago ? (form.data_pagamento || hoje) : null,
      status: form.jaPago ? "pago" : "a_vencer",
      observacoes: form.observacoes?.trim() || null,
      user_id: user.id,
    };

    let error;
    if (editingId) {
      const { user_id, ...updatePayload } = payload;
      ({ error } = await supabase.from("lancamentos").update(updatePayload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("lancamentos").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar lançamento", { description: error.message });
    } else {
      toast.success(editingId ? "Lançamento atualizado!" : "Lançamento criado!");
      setOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("lancamentos").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluído!"); fetchData(); }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const filteredCategories = categorias.filter(
    (c) => c.tipo === form.tipo || c.tipo === "ambos"
  );

  // Group by date
  const grouped = lancamentos.reduce<Record<string, any[]>>((acc, l) => {
    const d = l.data_vencimento;
    if (!acc[d]) acc[d] = [];
    acc[d].push(l);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <div className="flex gap-2">
            <Button className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => openNew("receita")}>
              <Plus className="h-4 w-4 mr-2" />Receita
            </Button>
            <Button variant="destructive" onClick={() => openNew("despesa")}>
              <Minus className="h-4 w-4 mr-2" />Despesa
            </Button>
          </div>
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Lançamento" : form.tipo === "receita" ? "➕ Nova Receita" : "➖ Nova Despesa"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3">
                <Button type="button" variant={form.tipo === "receita" ? "default" : "outline"} className={form.tipo === "receita" ? "bg-success hover:bg-success/90 flex-1" : "flex-1"} onClick={() => setForm({ ...form, tipo: "receita", categoria_id: "" })}>
                  Receita
                </Button>
                <Button type="button" variant={form.tipo === "despesa" ? "destructive" : "outline"} className="flex-1" onClick={() => setForm({ ...form, tipo: "despesa", categoria_id: "" })}>
                  Despesa
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required maxLength={200} placeholder="Ex: Pagamento aluguel" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Data Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Conta *</Label>
                <Select value={form.conta_id} onValueChange={(v) => setForm({ ...form, conta_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Categoria</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setCatOpen(true)}>
                    <Settings className="h-3 w-3" /> Gerenciar
                  </Button>
                </div>
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="jaPago" checked={form.jaPago} onCheckedChange={(v) => setForm({ ...form, jaPago: !!v, data_pagamento: v ? hoje : "" })} />
                <Label htmlFor="jaPago" className="cursor-pointer">Já foi pago/recebido?</Label>
              </div>
              {form.jaPago && (
                <div className="space-y-2">
                  <Label>Data Pagamento</Label>
                  <Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} maxLength={500} placeholder="Opcional" />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1">💾 Salvar</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); resetForm(); }}>❌ Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="p-0">
            {sortedDates.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">Nenhum lançamento encontrado.</p>
            ) : (
              <div className="divide-y divide-border">
                {sortedDates.map(date => (
                  <div key={date} className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      {dateHelper.formatarDataCompleta(date)}
                    </p>
                    <div className="space-y-1">
                      {grouped[date].map((l: any) => (
                        <div key={l.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-base shrink-0">{l.contas?.icone || "💰"}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm truncate">{l.descricao}</p>
                                {l.observacoes?.includes("🔄 Fixa:") && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">🔄 Fixa</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{l.categorias?.nome} · {l.contas?.nome}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-semibold text-sm ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                              {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "pago" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                              {l.status === "pago" ? "✅" : "⏳"}
                            </span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(l.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
      </div>
    </DashboardLayout>
  );
};

export default Lancamentos;
