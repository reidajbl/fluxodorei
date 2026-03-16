import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Settings } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import GerenciarCategorias from "@/components/GerenciarCategorias";

interface LancamentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLancamento?: any | null;
  defaultTipo?: string;
  onSaved: () => void;
}

const LancamentoFormDialog = ({ open, onOpenChange, editingLancamento, defaultTipo = "despesa", onSaved }: LancamentoFormDialogProps) => {
  const { user } = useAuth();
  const hoje = dateHelper.hojeStr();
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [form, setForm] = useState({
    descricao: "", valor: "", tipo: defaultTipo, conta_id: "", categoria_id: "",
    data_vencimento: hoje, data_pagamento: "", jaPago: false, observacoes: "",
  });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("contas").select("*").eq("ativo", true),
      supabase.from("categorias").select("*"),
    ]).then(([{ data: c }, { data: cat }]) => {
      if (c) setContas(c);
      if (cat) setCategorias(cat);
    });
  }, [user]);

  useEffect(() => {
    if (editingLancamento) {
      setForm({
        descricao: editingLancamento.descricao,
        valor: String(editingLancamento.valor),
        tipo: editingLancamento.tipo,
        conta_id: editingLancamento.conta_id,
        categoria_id: editingLancamento.categoria_id || "",
        data_vencimento: editingLancamento.data_vencimento,
        data_pagamento: editingLancamento.data_pagamento || "",
        jaPago: editingLancamento.status === "pago",
        observacoes: editingLancamento.observacoes || "",
      });
    } else {
      setForm({
        descricao: "", valor: "", tipo: defaultTipo, conta_id: "", categoria_id: "",
        data_vencimento: hoje, data_pagamento: "", jaPago: false, observacoes: "",
      });
    }
  }, [editingLancamento, defaultTipo, open]);

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
    if (editingLancamento) {
      const { user_id, ...upd } = payload;
      ({ error } = await supabase.from("lancamentos").update(upd).eq("id", editingLancamento.id));
    } else {
      ({ error } = await supabase.from("lancamentos").insert(payload));
    }
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else { toast.success(editingLancamento ? "Atualizado!" : "Criado!"); onOpenChange(false); onSaved(); }
  };

  const filteredCategories = categorias.filter(c => c.tipo === form.tipo || c.tipo === "ambos");

  const fetchCategorias = async () => {
    const { data } = await supabase.from("categorias").select("*");
    if (data) setCategorias(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLancamento ? "Editar Lançamento" : form.tipo === "receita" ? "➕ Nova Receita" : "➖ Nova Despesa"}</DialogTitle>
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
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>❌ Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <GerenciarCategorias open={catOpen} onOpenChange={setCatOpen} onUpdate={fetchCategorias} />
    </>
  );
};

export default LancamentoFormDialog;
