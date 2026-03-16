import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { registrarLog } from "@/lib/logger";

const ICONES = ["💰", "🏦", "💳", "👛", "🪙", "💵", "📱"];
const TIPOS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "banco", label: "Banco" },
  { value: "carteira", label: "Carteira Digital" },
  { value: "outro", label: "Outro" },
];

const Contas = () => {
  const { user } = useAuth();
  const [contas, setContas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "banco", saldo_inicial: "0", icone: "💰", cor: "#3b82f6" });

  const fetchContas = async () => {
    if (!user) return;
    const { data } = await supabase.from("contas").select("*").order("created_at", { ascending: true });
    if (data) setContas(data);
  };

  useEffect(() => { fetchContas(); }, [user]);

  const resetForm = () => {
    setForm({ nome: "", tipo: "banco", saldo_inicial: "0", icone: "💰", cor: "#3b82f6" });
    setEditingId(null);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({ nome: c.nome, tipo: c.tipo || "banco", saldo_inicial: String(c.saldo_inicial || 0), icone: c.icone || "💰", cor: c.cor || "#3b82f6" });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload: any = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      saldo_inicial: parseFloat(form.saldo_inicial),
      icone: form.icone,
      cor: form.cor,
      ultima_alteracao_saldo: new Date().toISOString().split("T")[0],
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("contas").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("contas").insert({ ...payload, user_id: user.id }));
    }

    if (error) toast.error("Erro ao salvar conta", { description: error.message });
    else {
      toast.success(editingId ? "Conta atualizada!" : "Conta criada!");
      setOpen(false);
      resetForm();
      fetchContas();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contas").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir", { description: error.message });
    else { toast.success("Conta excluída!"); fetchContas(); }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contas</h1>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Conta" : "💰 Nova Conta"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da conta *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required maxLength={100} placeholder="Ex: Nubank, Caixa..." />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Saldo Inicial (R$)</Label>
                  <Input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <div className="flex gap-2 flex-wrap">
                    {ICONES.map((i) => (
                      <button key={i} type="button" onClick={() => setForm({ ...form, icone: i })}
                        className={`text-2xl p-2 rounded-lg border-2 transition-colors ${form.icone === i ? "border-primary bg-accent" : "border-transparent hover:border-border"}`}>
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-10 w-20" />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" className="flex-1">💾 Salvar</Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setOpen(false); resetForm(); }}>❌ Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {contas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma conta cadastrada. Crie sua primeira!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contas.map((c) => (
              <Card key={c.id} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: c.cor }} />
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{c.icone}</span>
                      <div>
                        <p className="font-semibold">{c.nome}</p>
                        <p className="text-xs text-muted-foreground capitalize">{c.tipo}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-4 text-xl font-bold">{formatCurrency(Number(c.saldo_inicial))}</p>
                  <p className="text-xs text-muted-foreground">Saldo inicial</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Contas;
