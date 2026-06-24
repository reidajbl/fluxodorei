import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Edit2, Trash2 } from "lucide-react";
import { dateHelper } from "@/lib/dateHelper";
import { registrarLog } from "@/lib/logger";

type Filtro = "todos" | "a_vencer" | "vencidos" | "pagos" | "recebidos";

function getStatusInfo(l: any) {
  const hoje = dateHelper.hojeStr();
  if (l.status === "pago" || l.data_pagamento) {
    if (l.tipo === "receita") return { label: "RECEBIDO", emoji: "✅", cls: "bg-success/10 text-success" };
    return { label: "PAGO", emoji: "✅", cls: "bg-success/10 text-success" };
  }
  if (l.data_vencimento < hoje) return { label: "VENCIDO", emoji: "🔴", cls: "bg-destructive/10 text-destructive" };
  return { label: "A VENCER", emoji: "🟡", cls: "bg-warning/10 text-warning" };
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface LancamentosListProps {
  lancamentos: any[];
  filtro: Filtro;
  busca: string;
  onEdit: (lancamento: any) => void;
  onDeleted: () => void;
}

const LancamentosList = ({ lancamentos, filtro, busca, onEdit, onDeleted }: LancamentosListProps) => {
  const hoje = dateHelper.hojeStr();

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      if (busca && !l.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      const status = getStatusInfo(l);
      if (filtro === "a_vencer") return status.label === "A VENCER";
      if (filtro === "vencidos") return status.label === "VENCIDO";
      if (filtro === "pagos") return l.tipo === "despesa" && status.label === "PAGO";
      if (filtro === "recebidos") return l.tipo === "receita" && status.label === "RECEBIDO";
      return true;
    });
  }, [lancamentos, filtro, busca]);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach(l => {
      const d = l.data_vencimento;
      if (!groups[d]) groups[d] = [];
      groups[d].push(l);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const handleDelete = async (id: string) => {
    const item = lancamentos.find(l => l.id === id);
    const { error } = await supabase.from("lancamentos").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      if (item) {
        await registrarLog({
          acao: "EXCLUIR", entidade: item.tipo === "receita" ? "RECEITA" : "DESPESA",
          entidade_id: id, dados_antes: item,
          descricao: `'${item.descricao}' de R$ ${item.valor} excluído`,
        });
      }
      toast.success("Excluído!"); onDeleted();
    }
  };

  if (grouped.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">Nenhum lançamento encontrado.</p>;
  }

  return (
    <div className="space-y-4">
      {grouped.map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {date === hoje ? "📌 HOJE — " : ""}{dateHelper.formatarDataCompleta(date)}
          </p>
          <div className="space-y-1 sm:space-y-1">
            {items.map((l: any) => {
              const st = getStatusInfo(l);
              return (
                <div key={l.id} className="group flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 px-3 rounded-xl border border-border bg-card hover:bg-accent/40 hover:shadow-sm transition-all gap-2 sm:gap-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-base">{l.contas?.icone || "💰"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate">{l.descricao}</p>
                        {l.observacoes?.includes("🔄 Fixa:") && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">🔄</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{l.categorias?.nome} · {l.contas?.nome || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-12 sm:pl-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    <span className={`font-bold text-base tabular-nums ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                      {l.tipo === "receita" ? "+" : "-"}{formatCurrency(Number(l.valor))}
                    </span>
                    <div className="flex items-center gap-0.5 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(l)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(l.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LancamentosList;
