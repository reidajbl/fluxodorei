import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ACOES = ["TODAS", "CRIAR", "EDITAR", "EXCLUIR", "ALTERAR_SALDO", "GERAR_FIXAS", "IMPORTAR", "EXPORTAR"];

const getAcaoBadge = (acao: string) => {
  switch (acao) {
    case "CRIAR": return "bg-success/10 text-success";
    case "EDITAR": return "bg-info/10 text-info";
    case "EXCLUIR": return "bg-destructive/10 text-destructive";
    case "ALTERAR_SALDO": return "bg-purple-500/10 text-purple-600";
    case "GERAR_FIXAS": return "bg-warning/10 text-warning";
    case "IMPORTAR": return "bg-blue-500/10 text-blue-600";
    case "EXPORTAR": return "bg-cyan-500/10 text-cyan-600";
    default: return "bg-muted text-muted-foreground";
  }
};

const LogsAuditoria = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [filtroAcao, setFiltroAcao] = useState("TODAS");
  const [busca, setBusca] = useState("");
  const [detailLog, setDetailLog] = useState<any>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = async () => {
    if (!user) return;
    let query = (supabase as any).from("logs_auditoria")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filtroAcao !== "TODAS") {
      query = query.eq("acao", filtroAcao);
    }
    if (busca.trim()) {
      query = query.ilike("descricao", `%${busca.trim()}%`);
    }

    const { data } = await query;
    if (data) setLogs(data);
  };

  useEffect(() => { fetchLogs(); }, [user, filtroAcao, busca, page]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">📋 Log de Auditoria</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filtroAcao} onValueChange={(v) => { setFiltroAcao(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACOES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar na descrição..." value={busca} onChange={e => { setBusca(e.target.value); setPage(0); }} className="pl-9" />
          </div>
        </div>

        {/* Logs list */}
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 hover:bg-accent/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getAcaoBadge(log.acao)}`}>
                        {log.acao}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{log.entidade}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                    </div>
                    <p className="text-sm mt-1 truncate">{log.descricao}</p>
                  </div>
                  {(log.dados_antes || log.dados_depois) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDetailLog(log)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Página {page + 1}</span>
          <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailLog} onOpenChange={(o) => { if (!o) setDetailLog(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🔍 Detalhes do Log</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div><strong>Ação:</strong> {detailLog.acao}</div>
              <div><strong>Entidade:</strong> {detailLog.entidade}</div>
              <div><strong>Data:</strong> {formatDate(detailLog.created_at)}</div>
              <div><strong>Descrição:</strong> {detailLog.descricao}</div>
              {detailLog.dados_antes && (
                <div>
                  <strong>Dados Antes:</strong>
                  <pre className="mt-1 p-3 bg-muted rounded-lg overflow-auto text-xs max-h-40">
                    {JSON.stringify(detailLog.dados_antes, null, 2)}
                  </pre>
                </div>
              )}
              {detailLog.dados_depois && (
                <div>
                  <strong>Dados Depois:</strong>
                  <pre className="mt-1 p-3 bg-muted rounded-lg overflow-auto text-xs max-h-40">
                    {JSON.stringify(detailLog.dados_depois, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default LogsAuditoria;
