import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import LancamentoFormDialog from "@/components/lancamentos/LancamentoFormDialog";
import LancamentosList from "@/components/lancamentos/LancamentosList";

type Filtro = "todos" | "a_vencer" | "vencidos" | "pagos" | "recebidos";

const TABS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "a_vencer", label: "A Vencer" },
  { key: "vencidos", label: "Vencidos" },
  { key: "pagos", label: "Pagos" },
  { key: "recebidos", label: "Recebidos" },
];

const Lancamentos = () => {
  const { user } = useAuth();
  const { forceUpdate } = useDashboard();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<any | null>(null);
  const [defaultTipo, setDefaultTipo] = useState("despesa");

  const { ano: anoAtual, mes: mesAtual } = dateHelper.mesAnoAtual();
  const [mesView, setMesView] = useState(mesAtual);
  const [anoView, setAnoView] = useState(anoAtual);

  const mesAnterior = () => { if (mesView === 1) { setMesView(12); setAnoView(anoView - 1); } else setMesView(mesView - 1); };
  const mesProximo = () => { if (mesView === 12) { setMesView(1); setAnoView(anoView + 1); } else setMesView(mesView + 1); };

  const fetchData = async () => {
    if (!user) return;
    const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
    const fim = dateHelper.ultimoDiaMes(anoView, mesView);
    const { data: l } = await supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome, icone)")
      .gte("data_vencimento", inicio).lte("data_vencimento", fim)
      .order("data_vencimento", { ascending: false });
    if (l) setLancamentos(l);
  };

  useEffect(() => { fetchData(); }, [user, mesView, anoView]);

  const openNew = (tipo: string) => {
    setEditingLancamento(null);
    setDefaultTipo(tipo);
    setDialogOpen(true);
  };

  const openEdit = (l: any) => {
    setEditingLancamento(l);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    fetchData();
    forceUpdate();
  };

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
          <Input placeholder="Buscar lançamento..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>

        {/* Dialog */}
        <LancamentoFormDialog
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingLancamento(null); }}
          editingLancamento={editingLancamento}
          defaultTipo={defaultTipo}
          onSaved={handleSaved}
        />

        {/* List */}
        <Card>
          <CardContent className="p-4">
            <LancamentosList
              lancamentos={lancamentos}
              filtro={filtro}
              busca={busca}
              onEdit={openEdit}
              onDeleted={handleSaved}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Lancamentos;
