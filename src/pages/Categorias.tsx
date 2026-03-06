import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/sonner";
import { Plus, Search, Pencil, Trash2, Tag } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ICONES = [
  "💰", "💵", "💳", "🏦", "💸", "🛒", "🍔", "🚗", "🏠",
  "📱", "💡", "💧", "🔥", "🎮", "🏥", "📚", "✈️", "🎵",
  "👕", "💼", "🎓", "🐶", "🌿", "⚡", "📦", "🔧", "🎨",
];

const CORES = [
  "#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6b7280",
];

interface Categoria {
  id: string;
  nome: string;
  tipo: string | null;
  cor: string | null;
  user_id: string;
  empresa_id: string | null;
}

const Categorias = () => {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [usoMap, setUsoMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null);
  const [excluindoCategoria, setExcluindoCategoria] = useState<Categoria | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Form state
  const [formNome, setFormNome] = useState("");
  const [formTipo, setFormTipo] = useState("ambos");
  const [formCor, setFormCor] = useState("#10b981");
  const [formIcone, setFormIcone] = useState("💰");

  const carregarCategorias = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: cats }, { data: lancs }] = await Promise.all([
        supabase.from("categorias").select("*").eq("user_id", user.id).order("nome"),
        supabase.from("lancamentos").select("categoria_id").eq("user_id", user.id),
      ]);
      setCategorias(cats || []);

      // Count usage
      const map: Record<string, number> = {};
      (lancs || []).forEach((l: any) => {
        if (l.categoria_id) map[l.categoria_id] = (map[l.categoria_id] || 0) + 1;
      });
      setUsoMap(map);
    } catch {
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { carregarCategorias(); }, [carregarCategorias]);

  const abrirModal = (cat?: Categoria) => {
    if (cat) {
      setCategoriaEditando(cat);
      setFormNome(cat.nome);
      setFormTipo(cat.tipo || "ambos");
      setFormCor(cat.cor || "#10b981");
      // Extract emoji from nome if no dedicated icon field
      setFormIcone("🏷️");
    } else {
      setCategoriaEditando(null);
      setFormNome("");
      setFormTipo("ambos");
      setFormCor("#10b981");
      setFormIcone("💰");
    }
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    if (!formNome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!user) return;
    setSalvando(true);
    try {
      const dados = {
        nome: formNome.trim(),
        tipo: formTipo,
        cor: formCor,
        user_id: user.id,
      };

      if (categoriaEditando) {
        const { error } = await supabase.from("categorias").update(dados).eq("id", categoriaEditando.id);
        if (error) throw error;
        toast.success("Categoria atualizada!");
      } else {
        const { error } = await supabase.from("categorias").insert([dados]);
        if (error) throw error;
        toast.success("Categoria criada!");
      }
      setModalAberto(false);
      carregarCategorias();
    } catch {
      toast.error("Erro ao salvar categoria");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!excluindoCategoria) return;
    const uso = usoMap[excluindoCategoria.id] || 0;
    if (uso > 0) {
      toast.error(`Não é possível excluir: categoria usada em ${uso} lançamento(s)`);
      setExcluindoCategoria(null);
      return;
    }
    try {
      const { error } = await supabase.from("categorias").delete().eq("id", excluindoCategoria.id);
      if (error) throw error;
      toast.success("Categoria excluída!");
      carregarCategorias();
    } catch {
      toast.error("Erro ao excluir categoria");
    } finally {
      setExcluindoCategoria(null);
    }
  };

  const categoriasFiltradas = categorias.filter((cat) => {
    if (filtroTipo === "receitas" && cat.tipo === "despesa") return false;
    if (filtroTipo === "despesas" && cat.tipo === "receita") return false;
    if (busca && !cat.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const totalReceitas = categorias.filter((c) => c.tipo !== "despesa").length;
  const totalDespesas = categorias.filter((c) => c.tipo !== "receita").length;

  const getTipoLabel = (tipo: string | null) => {
    switch (tipo) {
      case "ambos": return "Receitas e Despesas";
      case "receita": return "Apenas Receitas";
      case "despesa": return "Apenas Despesas";
      default: return "Receitas e Despesas";
    }
  };

  const getTipoCor = (tipo: string | null) => {
    switch (tipo) {
      case "receita": return "text-green-600 dark:text-green-400";
      case "despesa": return "text-red-600 dark:text-red-400";
      default: return "text-purple-600 dark:text-purple-400";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Tag className="h-6 w-6" /> Gerenciar Categorias
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize suas receitas e despesas por categorias
            </p>
          </div>
          <Button onClick={() => abrirModal()} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Categoria
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: "todas", label: "Todas" },
              { key: "receitas", label: "Receitas" },
              { key: "despesas", label: "Despesas" },
            ].map((f) => (
              <Button
                key={f.key}
                variant={filtroTipo === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroTipo(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Category List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : categoriasFiltradas.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              {busca || filtroTipo !== "todas"
                ? "Nenhuma categoria encontrada com esses filtros"
                : 'Nenhuma categoria cadastrada. Clique em "Nova Categoria" para começar.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {categoriasFiltradas.map((cat) => {
              const uso = usoMap[cat.id] || 0;
              return (
                <Card key={cat.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg text-white font-bold shrink-0"
                        style={{ backgroundColor: cat.cor || "#6b7280" }}
                      >
                        {cat.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{cat.nome}</h3>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={getTipoCor(cat.tipo)}>{getTipoLabel(cat.tipo)}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {uso} {uso === 1 ? "lançamento" : "lançamentos"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirModal(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setExcluindoCategoria(cat)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Stats footer */}
        <p className="text-sm text-muted-foreground text-center">
          Total: {categorias.length} categorias • 💰 {totalReceitas} de receitas • 💸 {totalDespesas} de despesas
        </p>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {categoriaEditando ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Categoria *</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: PIX, Aluguel, Salário..."
                autoFocus
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <RadioGroup value={formTipo} onValueChange={setFormTipo} className="mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ambos" id="ambos" />
                  <Label htmlFor="ambos">💼 Receitas e Despesas</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="receita" id="receita" />
                  <Label htmlFor="receita" className="text-green-600">💰 Apenas Receitas</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="despesa" id="despesa" />
                  <Label htmlFor="despesa" className="text-red-600">💸 Apenas Despesas</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {CORES.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setFormCor(cor)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      formCor === cor ? "border-ring scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Preview:</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg text-white font-bold"
                  style={{ backgroundColor: formCor }}
                >
                  {(formNome || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-foreground">{formNome || "Nome da categoria"}</p>
                  <p className="text-sm text-muted-foreground">{getTipoLabel(formTipo)}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? "Salvando..." : categoriaEditando ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!excluindoCategoria} onOpenChange={() => setExcluindoCategoria(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{excluindoCategoria?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Categorias;
