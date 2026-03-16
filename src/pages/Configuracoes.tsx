import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Download, Upload, FileJson, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { registrarLog } from "@/lib/logger";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BackupData {
  metadata: {
    versao: string;
    data: string;
    usuario: string | undefined;
    app: string;
  };
  dados: {
    contas: any[];
    categorias: any[];
    lancamentos: any[];
    despesasFixas: any[];
  };
  estatisticas: {
    totalContas: number;
    totalCategorias: number;
    totalLancamentos: number;
    totalFixas: number;
  };
}

interface HistoricoItem {
  data: string;
  arquivo: string;
  estatisticas: BackupData["estatisticas"];
}

const Configuracoes = () => {
  const { user } = useAuth();
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("backupHistorico") || "[]");
    setHistorico(saved);
  }, []);

  // ─── EXPORTAR ───
  const exportarBackup = async () => {
    if (!user) return;
    setExportando(true);
    try {
      const [{ data: contas }, { data: categorias }, { data: lancamentos }, { data: fixas }] = await Promise.all([
        supabase.from("contas").select("*"),
        supabase.from("categorias").select("*"),
        supabase.from("lancamentos").select("*"),
        supabase.from("despesas_fixas").select("*"),
      ]);

      const backup: BackupData = {
        metadata: {
          versao: "2.0",
          data: new Date().toISOString(),
          usuario: user.email,
          app: "FLUXO REI DA JBL",
        },
        dados: {
          contas: contas || [],
          categorias: categorias || [],
          lancamentos: lancamentos || [],
          despesasFixas: fixas || [],
        },
        estatisticas: {
          totalContas: contas?.length || 0,
          totalCategorias: categorias?.length || 0,
          totalLancamentos: lancamentos?.length || 0,
          totalFixas: fixas?.length || 0,
        },
      };

      const dataStr = new Date().toISOString().slice(0, 16).replace(/:/g, "-");
      const fileName = `fluxo_rei_backup_${dataStr}.json`;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Salvar histórico
      const newHistorico: HistoricoItem[] = [
        { data: new Date().toISOString(), arquivo: fileName, estatisticas: backup.estatisticas },
        ...historico,
      ].slice(0, 10);
      localStorage.setItem("backupHistorico", JSON.stringify(newHistorico));
      setHistorico(newHistorico);

      await registrarLog({ acao: "EXPORTAR", entidade: "BACKUP", descricao: `Backup exportado: ${backup.estatisticas.totalLancamentos} lançamentos, ${backup.estatisticas.totalContas} contas` });
      toast.success("Backup exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao exportar backup.");
    } finally {
      setExportando(false);
    }
  };

  // ─── IMPORTAR ───
  const importarBackup = async () => {
    if (!user || !arquivo) return;
    setImportando(true);
    setConfirmOpen(false);
    try {
      const texto = await arquivo.text();
      const backup: BackupData = JSON.parse(texto);

      if (!backup.metadata || !backup.dados) {
        throw new Error("Estrutura de backup inválida.");
      }

      // Limpar dados existentes (order matters due to FK)
      await supabase.from("lancamentos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("despesas_fixas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("categorias").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("contas").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const results = { contas: 0, categorias: 0, lancamentos: 0, fixas: 0 };

      // Map old IDs to new IDs
      const contaIdMap: Record<string, string> = {};
      const catIdMap: Record<string, string> = {};

      // Insert contas
      for (const c of backup.dados.contas) {
        const oldId = c.id;
        const { data, error } = await supabase.from("contas").insert({
          nome: c.nome, tipo: c.tipo, cor: c.cor, icone: c.icone,
          saldo_inicial: c.saldo_inicial, ativo: c.ativo ?? true, user_id: user.id,
        }).select("id").single();
        if (!error && data) { contaIdMap[oldId] = data.id; results.contas++; }
      }

      // Insert categorias
      for (const cat of backup.dados.categorias) {
        const oldId = cat.id;
        const { data, error } = await supabase.from("categorias").insert({
          nome: cat.nome, tipo: cat.tipo, cor: cat.cor, user_id: user.id,
        }).select("id").single();
        if (!error && data) { catIdMap[oldId] = data.id; results.categorias++; }
      }

      // Insert lancamentos
      for (const l of backup.dados.lancamentos) {
        const contaId = contaIdMap[l.conta_id];
        if (!contaId) continue;
        const { error } = await supabase.from("lancamentos").insert({
          descricao: l.descricao, valor: l.valor, tipo: l.tipo,
          data_vencimento: l.data_vencimento, data_pagamento: l.data_pagamento,
          status: l.status, observacoes: l.observacoes, user_id: user.id,
          conta_id: contaId, categoria_id: catIdMap[l.categoria_id] || null,
        });
        if (!error) results.lancamentos++;
      }

      // Insert despesas fixas
      for (const f of backup.dados.despesasFixas) {
        const contaId = contaIdMap[f.conta_id];
        if (!contaId) continue;
        const { error } = await supabase.from("despesas_fixas").insert({
          descricao: f.descricao, valor: f.valor, dia_vencimento: f.dia_vencimento,
          data_inicio: f.data_inicio, data_fim: f.data_fim, ativo: f.ativo ?? true,
          user_id: user.id, conta_id: contaId, categoria_id: catIdMap[f.categoria_id] || null,
        });
        if (!error) results.fixas++;
      }

      await registrarLog({ acao: "IMPORTAR", entidade: "BACKUP", descricao: `Backup importado: ${results.contas} contas, ${results.categorias} categorias, ${results.lancamentos} lançamentos, ${results.fixas} fixas` });
      toast.success(`Importação concluída! ${results.contas} contas, ${results.categorias} categorias, ${results.lancamentos} lançamentos, ${results.fixas} fixas.`);
      setArquivo(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(`Erro: ${e.message || "Falha na importação"}`);
    } finally {
      setImportando(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">⚙️ Configurações</h1>

        {/* Backup Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Exportar Backup</CardTitle>
            <CardDescription>Baixe todos os seus dados (contas, categorias, lançamentos, fixas) em arquivo .json</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportarBackup} disabled={exportando} className="w-full sm:w-auto">
              <FileJson className="h-4 w-4 mr-2" />
              {exportando ? "Gerando..." : "📥 Exportar Backup"}
            </Button>
          </CardContent>
        </Card>

        {/* Backup Import */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Importar Backup</CardTitle>
            <CardDescription>Restaure seus dados a partir de um arquivo .json exportado anteriormente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-destructive font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              ATENÇÃO: Isso substituirá TODOS os seus dados atuais!
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={e => setArquivo(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            />
            <Button
              variant="destructive"
              disabled={!arquivo || importando}
              onClick={() => setConfirmOpen(true)}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importando ? "Importando..." : "⬆️ Importar Dados"}
            </Button>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Últimos Backups</CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum backup registrado.</p>
            ) : (
              <div className="space-y-3">
                {historico.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">💾</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{h.arquivo}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(h.data)}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <p>{h.estatisticas.totalLancamentos} lançamentos</p>
                      <p>{h.estatisticas.totalContas} contas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmar importação</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá APAGAR todos os seus dados atuais e substituí-los pelo conteúdo do backup. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={importarBackup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, importar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Configuracoes;
