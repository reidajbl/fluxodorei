import { useState, useCallback, useMemo } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { useDados } from "@/contexts/DadosContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, ShieldAlert, ShieldX, Play, Wrench, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { executarDiagnostico, type DiagnosticoResultado, type Correcao, type Severidade } from "@/lib/diagnostico";
import { toast } from "@/components/ui/sonner";

const sevBadge = (s: Severidade) => {
  if (s === "ok") return { icon: ShieldCheck, label: "Sistema Saudável", cls: "bg-success text-success-foreground" };
  if (s === "warn") return { icon: ShieldAlert, label: "Atenção", cls: "bg-warning text-warning-foreground" };
  return { icon: ShieldX, label: "Problema Crítico", cls: "bg-destructive text-destructive-foreground" };
};

const sevIcon = (s: Severidade) =>
  s === "ok" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
  s === "warn" ? <AlertTriangle className="h-4 w-4 text-warning" /> :
  <XCircle className="h-4 w-4 text-destructive" />;

export default function Diagnostico() {
  const { contas, lancamentos, refresh } = useDados();
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<DiagnosticoResultado | null>(null);
  const [logLinhas, setLogLinhas] = useState<string[]>([]);
  const [showCorrecoes, setShowCorrecoes] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);

  const todasCorrecoes: Correcao[] = useMemo(
    () => resultado?.checks.flatMap(c => c.correcoes) || [],
    [resultado]
  );

  const executar = useCallback(async () => {
    setExecutando(true);
    setLogLinhas([]);
    try {
      const r = await executarDiagnostico(contas, lancamentos, setLogLinhas);
      setResultado(r);
      toast.success(`Diagnóstico concluído em ${r.duracaoMs.toFixed(0)}ms`);
    } catch (e: any) {
      toast.error("Erro ao executar diagnóstico: " + e.message);
    } finally {
      setExecutando(false);
    }
  }, [contas, lancamentos]);

  const abrirCorrecoes = () => {
    setSelecionadas(new Set(todasCorrecoes.map(c => c.id)));
    setShowCorrecoes(true);
  };

  const aplicarSelecionadas = async () => {
    setAplicando(true);
    let ok = 0, fail = 0;
    for (const c of todasCorrecoes) {
      if (!selecionadas.has(c.id)) continue;
      try { await c.aplicar(); ok++; } catch { fail++; }
    }
    setAplicando(false);
    setShowCorrecoes(false);
    toast.success(`${ok} correção(ões) aplicada(s)${fail ? `, ${fail} falha(s)` : ""}`);
    await refresh();
    await executar();
  };

  const toggle = (id: string) => {
    const n = new Set(selecionadas);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelecionadas(n);
  };

  const status = resultado ? sevBadge(resultado.statusGeral) : sevBadge("ok");
  const StatusIcon = status.icon;

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-6xl">
        {/* Header + status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-7 w-7 text-primary" />
                <div>
                  <CardTitle>Diagnóstico do Sistema</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verificações automáticas de integridade financeira
                  </p>
                </div>
              </div>
              <Badge className={`${status.cls} px-3 py-1.5 text-sm`}>
                <StatusIcon className="h-4 w-4 mr-1.5" />
                {resultado ? status.label : "Não executado"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center gap-2 flex-wrap">
            <Button onClick={executar} disabled={executando}>
              {executando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Diagnóstico
            </Button>
            <Button
              variant="outline"
              onClick={abrirCorrecoes}
              disabled={executando || todasCorrecoes.length === 0}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Corrigir Automaticamente ({todasCorrecoes.length})
            </Button>
            {resultado && (
              <span className="text-xs text-muted-foreground ml-auto">
                Último: {new Date(resultado.finalizadoEm).toLocaleString("pt-BR")} ·
                {" "}{resultado.duracaoMs.toFixed(0)}ms
              </span>
            )}
          </CardContent>
        </Card>

        {/* Checks list */}
        {resultado && (
          <div className="grid gap-3 md:grid-cols-2">
            {resultado.checks.map(c => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {sevIcon(c.severidade)}
                    <CardTitle className="text-sm">{c.titulo}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-48 overflow-y-auto">
                  {c.detalhes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum problema detectado.</p>
                  ) : (
                    c.detalhes.map((d, i) => (
                      <p key={i} className="text-xs font-mono">{d}</p>
                    ))
                  )}
                  {c.correcoes.length > 0 && (
                    <p className="text-xs text-primary mt-2">
                      💡 {c.correcoes.length} correção(ões) disponível(is)
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Terminal log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Log de Execução</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black rounded-md p-3 font-mono text-xs text-green-400 h-64 overflow-y-auto">
              {logLinhas.length === 0 ? (
                <p className="text-green-700">$ aguardando execução...</p>
              ) : (
                logLinhas.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Correções dialog — REGRA DE OURO: confirmação obrigatória */}
      <AlertDialog open={showCorrecoes} onOpenChange={setShowCorrecoes}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar correções</AlertDialogTitle>
            <AlertDialogDescription>
              Marque as correções que deseja aplicar. Cada uma alterará dados financeiros reais.
              Revise antes de confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 my-3">
            {todasCorrecoes.map(c => (
              <label key={c.id} className="flex items-start gap-2 p-2 rounded border border-border hover:bg-muted/30 cursor-pointer">
                <Checkbox checked={selecionadas.has(c.id)} onCheckedChange={() => toggle(c.id)} className="mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-medium">{c.label}</p>
                  <p className="text-muted-foreground font-mono mt-0.5">
                    antes: {JSON.stringify(c.antes)} → depois: {JSON.stringify(c.depois)}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aplicando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aplicarSelecionadas} disabled={aplicando || selecionadas.size === 0}>
              {aplicando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar {selecionadas.size} correção(ões)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
