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
import { Plus, Trash2, Edit2, Wrench, AlertTriangle } from "lucide-react";
import { registrarLog } from "@/lib/logger";
import { useDashboard } from "@/contexts/DashboardContext";
import { calcularSaldoConta } from "@/lib/saldoHelper";
import { useDados } from "@/contexts/DadosContext";

const ICONES = ["💰", "🏦", "💳", "👛", "🪙", "💵", "📱"];
const TIPOS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "banco", label: "Banco" },
  { value: "carteira", label: "Carteira Digital" },
  { value: "outro", label: "Outro" },
];

const Contas = () => {
  const { user } = useAuth();
  const { forceUpdate } = useDashboard();
  const { lancamentos: allLancamentos, refresh } = useDados();
  const [contas, setContas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "banco", saldo_inicial: "0", icone: "💰", cor: "#3b82f6" });
  const [contaTemLancamentos, setContaTemLancamentos] = useState(false);

  // Ajuste manual state
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteConta, setAjusteConta] = useState<any>(null);
  const [ajusteValor, setAjusteValor] = useState("");
  const [ajusteObs, setAjusteObs] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState<"receita" | "despesa">("receita");

  const fetchContas = async () => {
    if (!user) return;
    const { data } = await supabase.from("contas").select("*").order("created_at", { ascending: true });
    if (data) setContas(data);
  };

  useEffect(() => { fetchContas(); }, [user]);

  const resetForm = () => {
    setForm({ nome: "", tipo: "banco", saldo_inicial: "0", icone: "💰", cor: "#3b82f6" });
    setEditingId(null);
    setContaTemLancamentos(false);
  };

  const checkLancamentos = async (contaId: string) => {
    const { count } = await supabase
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("conta_id", contaId);
    return (count || 0) > 0;
  };

  const openEdit = async (c: any) => {
    setEditingId(c.id);
    setForm({ nome: c.nome, tipo: c.tipo || "banco", saldo_inicial: String(c.saldo_inicial || 0), icone: c.icone || "💰", cor: c.cor || "#3b82f6" });
    const temLanc = await checkLancamentos(c.id);
    setContaTemLancamentos(temLanc);
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

    // If editing and has lancamentos, don't change saldo_inicial
    if (editingId && contaTemLancamentos) {
      const contaOriginal = contas.find(c => c.id === editingId);
      payload.saldo_inicial = contaOriginal?.saldo_inicial || 0;
      delete payload.ultima_alteracao_saldo;
    }

    let error;
    if (editingId) {
      ({ error } = await supabase.from("contas").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("contas").insert({ ...payload, user_id: user.id }));
    }

    if (error) toast.error("Erro ao salvar conta", { description: error.message });
    else {
      const editingConta = contas.find(c => c.id === editingId);
      await registrarLog({
        acao: editingId ? "ALTERAR_SALDO" : "CRIAR", entidade: "CONTA",
        entidade_id: editingId || undefined,
        dados_antes: editingConta || null, dados_depois: payload,
        descricao: editingId
          ? `Conta '${form.nome}' editada — saldo: R$ ${editingConta?.saldo_inicial} → R$ ${payload.saldo_inicial}`
          : `Conta '${form.nome}' criada com saldo R$ ${payload.saldo_inicial}`,
      });
      toast.success(editingId ? "Conta atualizada!" : "Conta criada!");
      setOpen(false);
      resetForm();
      fetchContas();
      refresh();
      forceUpdate();
    }
  };

  const handleDelete = async (id: string) => {
    const conta = contas.find(c => c.id === id);
    const { error } = await supabase.from("contas").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir", { description: error.message });
    else {
      if (conta) await registrarLog({ acao: "EXCLUIR", entidade: "CONTA", entidade_id: id, dados_antes: conta, descricao: `Conta '${conta.nome}' excluída` });
      toast.success("Conta excluída!"); fetchContas(); refresh(); forceUpdate();
    }
  };

  const openAjuste = (conta: any) => {
    setAjusteConta(conta);
    setAjusteValor("");
    setAjusteObs("");
    setAjusteTipo("receita");
    setAjusteOpen(true);
  };

  const handleAjuste = async () => {
    if (!user || !ajusteConta || !ajusteValor) {
      toast.error("Preencha o valor do ajuste");
      return;
    }

    const valor = parseFloat(ajusteValor);
    if (isNaN(valor) || valor <= 0) {
      toast.error("Valor inválido");
      return;
    }

    // Find or use "Ajuste de caixa" category
    let categoriaId: string | null = null;
    const { data: cats } = await supabase.from("categorias").select("id, nome").eq("user_id", user.id);
    const ajusteCat = cats?.find(c => c.nome.includes("Ajuste de caixa") || c.nome.includes("Ajuste"));
    if (ajusteCat) {
      categoriaId = ajusteCat.id;
    } else {
      // Create the category
      const { data: newCat } = await supabase.from("categorias").insert({
        nome: "🔧 Ajuste de caixa",
        tipo: "ambos",
        cor: "#f59e0b",
        user_id: user.id,
      }).select("id").single();
      if (newCat) categoriaId = newCat.id;
    }

    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("lancamentos").insert({
      descricao: `Ajuste de caixa — ${ajusteConta.nome}`,
      valor,
      tipo: ajusteTipo,
      conta_id: ajusteConta.id,
      categoria_id: categoriaId,
      data_vencimento: hoje,
      data_pagamento: hoje,
      status: "pago",
      observacoes: ajusteObs || "Ajuste manual de caixa",
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao criar ajuste", { description: error.message });
    } else {
      await registrarLog({
        acao: "AJUSTE_CAIXA",
        entidade: "CONTA",
        entidade_id: ajusteConta.id,
        dados_depois: { valor, tipo: ajusteTipo, conta: ajusteConta.nome },
        descricao: `Ajuste de caixa: ${ajusteTipo === "receita" ? "+" : "-"}R$ ${valor.toFixed(2)} na conta '${ajusteConta.nome}'`,
      });
      toast.success(`Ajuste de ${ajusteTipo === "receita" ? "crédito" : "débito"} registrado!`);
      setAjusteOpen(false);
      refresh();
      forceUpdate();
    }
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
                  {editingId && contaTemLancamentos ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={form.saldo_inicial}
                        disabled
                        className="opacity-60 cursor-not-allowed"
                      />
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
                        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">
                          ⚠️ Esta conta já possui movimentações. Para corrigir diferenças, use o botão <strong>"🔧 Ajustar"</strong> no card da conta.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} />
                  )}
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
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {contas.map((c) => {
              const saldoReal = calcularSaldoConta(c, allLancamentos);
              return (
                <div key={c.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl border-2"
                    style={{ borderColor: c.cor, backgroundColor: `${c.cor}15` }}>
                    {c.icone}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {c.tipo} · Inicial: {formatCurrency(Number(c.saldo_inicial))}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-base font-bold tabular-nums ${saldoReal >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(saldoReal)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo atual</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-warning" onClick={() => openAjuste(c)} title="Ajuste manual">
                      <Wrench className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ajuste Manual Dialog */}
        <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>🔧 Ajuste Manual — {ajusteConta?.nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cria um lançamento de ajuste (já pago) para corrigir diferenças de caixa sem alterar o saldo inicial.
              </p>
              <div className="space-y-2">
                <Label>Tipo de ajuste</Label>
                <Select value={ajusteTipo} onValueChange={(v) => setAjusteTipo(v as "receita" | "despesa")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">➕ Crédito (aumentar saldo)</SelectItem>
                    <SelectItem value="despesa">➖ Débito (diminuir saldo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0.01" value={ajusteValor} onChange={(e) => setAjusteValor(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={ajusteObs} onChange={(e) => setAjusteObs(e.target.value)} placeholder="Motivo do ajuste..." maxLength={200} />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleAjuste}>💾 Registrar Ajuste</Button>
                <Button variant="outline" className="flex-1" onClick={() => setAjusteOpen(false)}>❌ Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Contas;
