import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";

const ICONES = ["💵", "💳", "💰", "📦", "🏦", "💸", "🪙", "💎"];
const CORES = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#6b7280", "#ec4899", "#06b6d4"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export default function GerenciarTiposRecebimento({ open, onOpenChange, onUpdate }: Props) {
  const { user } = useAuth();
  const [tipos, setTipos] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("💳");
  const [cor, setCor] = useState("#3b82f6");

  const fetch = async () => {
    if (!user) return;
    const { data } = await supabase.from("tipos_recebimento").select("*").order("nome");
    setTipos(data || []);
  };

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  const resetForm = () => { setNome(""); setIcone("💳"); setCor("#3b82f6"); setEditingId(null); setShowForm(false); };

  const handleSave = async () => {
    if (!user || !nome.trim()) { toast.error("Informe o nome"); return; }
    const payload = { nome: nome.trim(), icone, cor, user_id: user.id };
    let error;
    if (editingId) {
      const { user_id, ...upd } = payload;
      ({ error } = await supabase.from("tipos_recebimento").update(upd).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("tipos_recebimento").insert(payload));
    }
    if (error) toast.error("Erro ao salvar");
    else { toast.success("Salvo!"); resetForm(); fetch(); onUpdate(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tipos_recebimento").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluído!"); fetch(); onUpdate(); }
  };

  const openEdit = (t: any) => {
    setEditingId(t.id); setNome(t.nome); setIcone(t.icone || "💳"); setCor(t.cor || "#3b82f6"); setShowForm(true);
  };

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerenciar Tipos de Recebimento</DialogTitle>
        </DialogHeader>

        {!showForm ? (
          <div className="space-y-3">
            <Button className="w-full" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />Novo Tipo
            </Button>
            <div className="space-y-2 max-h-60 overflow-auto">
              {tipos.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                  <div className="flex items-center gap-2">
                    <span style={{ color: t.cor }}>{t.icone}</span>
                    <span className="text-sm font-medium">{t.nome}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {tipos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum tipo cadastrado.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: PIX" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex gap-2 flex-wrap">
                {ICONES.map(i => (
                  <button key={i} type="button" onClick={() => setIcone(i)}
                    className={`text-xl p-1.5 rounded border-2 transition-colors ${icone === i ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {CORES.map(c => (
                  <button key={c} type="button" onClick={() => setCor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${cor === c ? "border-primary scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleSave}>💾 Salvar</Button>
              <Button variant="outline" className="flex-1" onClick={resetForm}>❌ Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
