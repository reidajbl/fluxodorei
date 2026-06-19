import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Play, Wrench, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { executarDiagnostico, type CheckResult, type DiagnosticoReport, type Fix, type Severity } from "@/lib/diagnostico";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const sevColor: Record<Severity, string> = {
  ok: "bg-success text-success-foreground",
  warn: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};
const sevLabel: Record<Severity, string> = {
  ok: "Sistema Saudável",
  warn: "Atenção",
  critical: "Problema Crítico",
};
const SevIcon = ({ s }: { s: Severity }) =>
  s === "ok" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
  s === "warn" ? <AlertTriangle className="h-4 w-4 text-warning" /> :
  <XCircle className="h-4 w-4 text-destructive" />;

const Diagnostico = () => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiagnosticoReport | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setRunning(true);
    setLogLines([]);
    setReport(null);
    try {
      const r = await executarDiagnostico((line) => {
        setLogLines((prev) => [...prev, line]);
        requestAnimationFrame(() => {
          termRef.current?.scrollTo({ top: termRef.current.scrollHeight });
        });
      });
      setReport(r);
    } catch (e: any) {
      toast.error("Falha no diagnóstico: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const allFixes: { check: CheckResult; fix: Fix }[] =
    report?.checks.flatMap(c => (c.fixes || []).map(f => ({ check: c, fix: f }))) || [];

  const openFix = () => {
    const init: Record<string, boolean> = {};
    allFixes.forEach(({ fix }) => { init[fix.id] = false; });
    setSelected(init);
    setFixDialogOpen(true);
  };

  const applySelected = async () => {
    const toApply = allFixes.filter(({ fix }) => selected[fix.id]);
    if (toApply.length === 0) { toast.info("Nenhuma correção selecionada"); return; }
    setApplying(true);
    let ok = 0, fail = 0;
    for (const { fix, check } of toApply) {
      try {
        await fix.apply();
        await supabase.from("logs_auditoria").insert({
          usuario_id: (await supabase.auth.getUser()).data.user?.id,
          acao: "DIAGNOSTICO_CORRECAO", entidade: "DIAGNOSTICO",
          descricao: `[${check.titulo}] ${fix.label}`,
          user_agent: navigator.userAgent,
        });
        ok++;
      } catch { fail++; }
    }
    setApplying(false);
    setFixDialogOpen(false);
    toast.success(`${ok} correção(ões) aplicada(s)${fail ? `, ${fail} falha(s)` : ""}`);
    run();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Diagnóstico do Sistema</h1>
              <p className="text-xs text-muted-foreground">
                {report ? `Último: ${new Date(report.finishedAt).toLocaleString("pt-BR")} (${report.durationMs}ms)` : "Nunca executado nesta sessão"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <Badge className={sevColor[report.geral]}>{sevLabel[report.geral]}</Badge>
            )}
            <Button onClick={run} disabled={running} size="sm">
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Executar Diagnóstico
            </Button>
            <Button onClick={openFix} disabled={running || allFixes.length === 0} size="sm" variant="outline">
              <Wrench className="h-4 w-4 mr-1" />
              Corrigir ({allFixes.length})
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {report?.checks.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <SevIcon s={c.severidade} />
                  {c.titulo}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{c.mensagem}</p>
                {c.detalhes && c.detalhes.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                    {c.detalhes.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
                {c.fixes && c.fixes.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {c.fixes.length} correção(ões) propostas
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Log de Execução</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={termRef}
              className="bg-black text-green-400 font-mono text-xs p-3 rounded-md h-64 overflow-y-auto whitespace-pre-wrap"
            >
              {logLines.length === 0 ? "$ aguardando..." : logLines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar correções</AlertDialogTitle>
            <AlertDialogDescription>
              Marque apenas as correções que deseja aplicar. Operações financeiras
              não são executadas sem confirmação explícita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2 py-2">
            {allFixes.map(({ check, fix }) => (
              <label key={fix.id} className="flex items-start gap-2 p-2 rounded border border-border hover:bg-accent/50 cursor-pointer">
                <Checkbox
                  checked={!!selected[fix.id]}
                  onCheckedChange={(v) => setSelected(s => ({ ...s, [fix.id]: !!v }))}
                />
                <div className="text-xs">
                  <div className="font-medium text-muted-foreground">{check.titulo}</div>
                  <div>{fix.label}</div>
                </div>
              </label>
            ))}
            {allFixes.length === 0 && <p className="text-sm text-muted-foreground">Sem correções pendentes.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); applySelected(); }} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Aplicar selecionadas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Diagnostico;
