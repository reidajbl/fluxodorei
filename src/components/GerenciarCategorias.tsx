import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { registrarLog } from "@/lib/logger";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const GerenciarCategorias = ({ open, onOpenChange, onUpdate }: Props) => {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("ambos");

  const fetchCategorias = async () => {
    if (!user) return;
    const { data } = await supabase.from("categorias").select("*").order("nome");
    if (data) setCategorias(data);
  };

  useEffect(() => {
    if (open) fetchCategorias();
  }, [open, user]);

  const resetForm = () => {
    setNome("");
    setTipo("ambos");
    setEditingCat(null);
    setShowForm(false);
  };

  const openEdit = (cat: any) => {
    setEditingCat(cat);
    setNome(cat.nome);
    setTipo(cat.tipo || "ambos");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !nome.trim()) {
      toast.error("Preencha o nome da categoria");
      return;
    }
    const payload = { nome: nome.trim(), tipo, user_id: user.id };

    if (editingCat) {
      const { error } = await supabase.from("categorias").update({ nome: payload.nome, tipo: payload.tipo }).eq("id", editingCat.id);
      if (error) toast.error("Erro ao atualizar"); else toast.success("Categoria atualizada!");
    } else {
      const { error } = await supabase.from("categorias").insert(payload);
      if (error) toast.error("Erro ao criar"); else toast.success("Categoria criada!");
    }
    resetForm();
    fetchCategorias();
    onUpdate();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // Check if in use
    const { count } = await supabase.from("lancamentos").select("id", { count: "exact", head: true }).eq("categoria_id", deleteId);
    if (count && count > 0) {
      toast.error("Categoria em uso! Não pode ser excluída.");
      setDeleteId(null);
      return;
    }
    const { error } = await supabase.from("categorias").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir"); else { toast.success("Categoria excluída!"); fetchCategorias(); onUpdate(); }
    setDeleteId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🏷️ Gerenciar Categorias</DialogTitle>
          </DialogHeader>

          {!showForm ? (
            <div className="space-y-4">
              <Button className="w-full" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nova Categoria
              </Button>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categorias.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-lg bg-accent/50">
                    <span className="text-sm font-medium truncate">
                      {cat.nome}
                      <span className="text-xs text-muted-foreground ml-2">({cat.tipo || "ambos"})</span>
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(cat.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {categorias.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria</p>}
              </div>
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Alimentação" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Receitas e Despesas</SelectItem>
                    <SelectItem value="receita">Apenas Receitas</SelectItem>
                    <SelectItem value="despesa">Apenas Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleSave}>💾 Salvar</Button>
                <Button variant="outline" className="flex-1" onClick={resetForm}>❌ Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>Só será excluída se não estiver em uso em nenhum lançamento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GerenciarCategorias;
