import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const Lancamentos = () => {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    tipo: "despesa",
    conta_id: "",
    categoria_id: "",
    data_vencimento: format(new Date(), "yyyy-MM-dd"),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.conta_id) {
      toast.error("Selecione uma conta");
      return;
    }

    const { error } = await supabase.from("lancamentos").insert({
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      tipo: form.tipo,
      conta_id: form.conta_id,
      categoria_id: form.categoria_id || null,
      data_vencimento: form.data_vencimento,
      observacoes: form.observacoes || null,
      status: "a_vencer",
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao criar lançamento", { description: error.message });
    } else {
      toast.success("Lançamento criado!");
      setOpen(false);
      setForm({ descricao: "", valor: "", tipo: "despesa", conta_id: "", categoria_id: "", data_vencimento: format(new Date(), "yyyy-MM-dd"), observacoes: "" });
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v, categoria_id: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Select value={form.conta_id} onValueChange={(v) => setForm({ ...form, conta_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Vencimento</Label>
                  <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">Salvar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {lancamentos.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">Nenhum lançamento encontrado.</p>
            ) : (
              <div className="divide-y divide-border">
                {lancamentos.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">{l.contas?.icone || "💰"}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{l.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.categorias?.nome} · {l.data_vencimento}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-sm whitespace-nowrap ${l.tipo === "receita" ? "text-emerald-600" : "text-red-600"}`}>
                        {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
