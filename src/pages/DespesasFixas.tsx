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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";

const DespesasFixas = () => {
  const { user } = useAuth();
  const [fixas, setFixas] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const hoje = dateHelper.hojeStr();
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    conta_id: "",
    categoria_id: "",
    dia_vencimento: "5",
    data_inicio: hoje,
    data_fim: "",
    ativo: true,
  });

  const fetchData = async () => {
    if (!user) return;
    const [{ data: f }, { data: c }, { data: cat }] = await Promise.all([
      supabase.from("despesas_fixas").select("*, categorias(nome, cor), contas(nome, icone)").order("descricao"),
      supabase.from("contas").select("*").eq("ativo", true),
      supabase.from("categorias").select("*"),
    ]);
    if (f) setFixas(f);
    if (c) setContas(c);
    if (cat) setCategorias(cat);
  };

  useEffect(() => { fetchData(); }, [user]);

  const resetForm = () => {
    setForm({ descricao: "", valor: "", conta_id: "", categoria_id: "", dia_vencimento: "5", data_inicio: hoje, data_fim: "", ativo: true });
    setEditingId(null);
  };

  const openEdit = (f: any) => {
    setEditingId(f.id);
    setForm({
      descricao: f.descricao,
      valor: String(f.valor),
      conta_id: f.conta_id,
      categoria_id: f.categoria_id || "",
      dia_vencimento: String(f.dia_vencimento),
      data_inicio: f.data_inicio,
      data_fim: f.data_fim || "",
      ativo: f.ativo ?? true,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.conta_id) {
      toast.error("Selecione uma conta");
      return;
    }
    const diaVenc = parseInt(form.dia_vencimento);
    if (isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) {
      toast.error("Dia do vencimento deve ser entre 1 e 31");
      return;
    }

    const payload = {
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor),
      conta_id: form.conta_id,
      categoria_id: form.categoria_id || null,
      dia_vencimento: diaVenc,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      ativo: form.ativo,
      user_id: user.id,
    };

    let error;
    if (editingId) {
      const { user_id, ...updatePayload } = payload;
      ({ error } = await supabase.from("despesas_fixas").update(updatePayload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("despesas_fixas").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success(editingId ? "Atualizada!" : "Despesa fixa criada!");
      setOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("despesas_fixas").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluída!"); fetchData(); }
  };

  const toggleAtivo = async (f: any) => {
    const { error } = await supabase.from("despesas_fixas").update({ ativo: !f.ativo }).eq("id", f.id);
    if (!error) fetchData();
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const totalFixas = fixas.filter(f => f.ativo).reduce((acc, f) => acc + Number(f.valor), 0);

  const despesaCategorias = categorias.filter(c => c.tipo === "despesa" || c.tipo === "ambos");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">🔁 Despesas Fixas</h1>
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nova
          </Button>
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "✏️ Editar Despesa Fixa" : "🔁 Nova Despesa Fixa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>📝 Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required maxLength={200} placeholder="Ex: Aluguel Loja" />
              </div>
              <div className="space-y-2">
                <Label>💰 Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>🏦 Conta *</Label>
                <Select value={form.conta_id} onValueChange={(v) => setForm({ ...form, conta_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>🏷️ Categoria</Label>
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {despesaCategorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>📅 Dia do vencimento * (1-31)</Label>
                <Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>📆 Data início *</Label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>📆 Data fim</Label>
                  <Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: !!v })} />
                <Label htmlFor="ativo" className="cursor-pointer">⏺️ Ativo</Label>
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1">💾 Salvar</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); resetForm(); }}>❌ Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {fixas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma despesa fixa cadastrada.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {fixas.map((f) => (
                <Card key={f.id} className={`transition-opacity ${!f.ativo ? "opacity-50" : ""}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{f.categorias?.nome?.split(" ")[0] || "🔄"} {f.descricao}</span>
                          {f.ativo ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Ativo ✅</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inativo</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          💰 {formatCurrency(Number(f.valor))}/mês · 📅 Dia {f.dia_vencimento} · 🏦 {f.contas?.nome || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          📆 {dateHelper.formatarParaExibicao(f.data_inicio)} → {f.data_fim ? dateHelper.formatarParaExibicao(f.data_fim) : "✨ Indeterminado"}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAtivo(f)}>
                          {f.ativo ? "⏸️" : "▶️"}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="py-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">📊 Total Fixas (ativas)</span>
                  <span className="font-bold text-destructive">{formatCurrency(totalFixas)}/mês</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DespesasFixas;
