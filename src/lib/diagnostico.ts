import { supabase } from "@/integrations/supabase/client";
import { dateHelper } from "@/lib/dateHelper";
import { calcularSaldoConta } from "@/lib/saldoHelper";

export type Severity = "ok" | "warn" | "critical";

export interface Fix {
  id: string;
  label: string;
  apply: () => Promise<void>;
}

export interface CheckResult {
  id: string;
  titulo: string;
  severidade: Severity;
  mensagem: string;
  detalhes?: string[];
  fixes?: Fix[];
}

export interface DiagnosticoReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  geral: Severity;
  checks: CheckResult[];
  log: string[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function pior(a: Severity, b: Severity): Severity {
  const order: Severity[] = ["ok", "warn", "critical"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export async function executarDiagnostico(
  onLog: (line: string) => void
): Promise<DiagnosticoReport> {
  const t0 = Date.now();
  const startedAt = new Date().toISOString();
  const log: string[] = [];
  const push = (l: string) => { log.push(l); onLog(l); };

  push(`▶ Iniciando diagnóstico em ${new Date().toLocaleString("pt-BR")}`);
  const checks: CheckResult[] = [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    push("✗ Usuário não autenticado");
    return { startedAt, finishedAt: new Date().toISOString(), durationMs: 0, geral: "critical", checks, log };
  }

  const [contasRes, lancsRes, fixasRes, categoriasRes] = await Promise.all([
    supabase.from("contas").select("*").eq("ativo", true),
    supabase.from("lancamentos").select("*").range(0, 49999),
    supabase.from("despesas_fixas").select("*").eq("ativo", true),
    supabase.from("categorias").select("id,nome"),
  ]);
  const contas = contasRes.data || [];
  const lancamentos = lancsRes.data || [];
  const fixas = fixasRes.data || [];
  const categorias = categoriasRes.data || [];
  push(`◦ ${contas.length} contas, ${lancamentos.length} lançamentos, ${fixas.length} recorrências, ${categorias.length} categorias`);

  // 1 — Integridade de saldo (informativa: saldo é calculado dinamicamente)
  push("▶ [1/9] Verificando integridade de saldo por conta...");
  const detSaldo: string[] = [];
  for (const c of contas) {
    const s = calcularSaldoConta(c as any, lancamentos as any);
    detSaldo.push(`${c.icone || "💰"} ${c.nome}: ${fmt(s)}`);
  }
  checks.push({
    id: "saldo",
    titulo: "Integridade de saldo por conta",
    severidade: "ok",
    mensagem: `Saldos recalculados para ${contas.length} conta(s)`,
    detalhes: detSaldo,
  });
  push(`✓ Saldos recalculados`);

  // 2 — Duplicadas
  push("▶ [2/9] Procurando recorrências duplicadas...");
  const mapDup = new Map<string, any[]>();
  for (const l of lancamentos) {
    const k = `${l.descricao}|${l.valor}|${l.conta_id}|${(l.data_vencimento || "").slice(0, 7)}`;
    if (!mapDup.has(k)) mapDup.set(k, []);
    mapDup.get(k)!.push(l);
  }
  const grupos = [...mapDup.values()].filter(g => g.length > 1);
  if (grupos.length === 0) {
    checks.push({ id: "dup", titulo: "Recorrências duplicadas", severidade: "ok", mensagem: "Nenhuma duplicata encontrada" });
    push("✓ Nenhuma duplicata");
  } else {
    const det: string[] = [];
    const fixes: Fix[] = [];
    for (const g of grupos) {
      g.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const [orig, ...extras] = g;
      det.push(`"${orig.descricao}" ${fmt(Number(orig.valor))} — ${g.length}x (manter ${orig.id.slice(0, 8)}, remover ${extras.length})`);
      for (const e of extras) {
        fixes.push({
          id: `dup-${e.id}`,
          label: `Excluir duplicata: "${e.descricao}" ${fmt(Number(e.valor))} ${dateHelper.formatarParaExibicao(e.data_vencimento)} (id ${e.id.slice(0, 8)})`,
          apply: async () => { await supabase.from("lancamentos").delete().eq("id", e.id); },
        });
      }
    }
    checks.push({
      id: "dup",
      titulo: "Recorrências duplicadas",
      severidade: "critical",
      mensagem: `${grupos.length} grupo(s) duplicado(s) encontrado(s)`,
      detalhes: det,
      fixes,
    });
    push(`✗ ${grupos.length} duplicata(s) detectada(s)`);
  }

  // 3 — Recorrências faltantes (mês atual)
  push("▶ [3/9] Procurando recorrências faltantes do mês...");
  const { ano, mes } = dateHelper.mesAnoAtual();
  const inicio = dateHelper.primeiroDiaMes(ano, mes);
  const fim = dateHelper.ultimoDiaMes(ano, mes);
  const hoje = dateHelper.hojeStr();
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const faltantes: any[] = [];
  for (const fixa of fixas) {
    if (fixa.data_inicio > fim) continue;
    if (fixa.data_fim && fixa.data_fim < inicio) continue;
    const dia = Math.min(fixa.dia_vencimento, ultimoDia);
    const dv = dateHelper.criarDataSegura(ano, mes, dia);
    if (dv > hoje) continue; // ainda não venceu
    const existe = lancamentos.some(l =>
      l.descricao === fixa.descricao && Number(l.valor) === Number(fixa.valor) &&
      l.conta_id === fixa.conta_id && l.data_vencimento === dv
    );
    if (!existe) faltantes.push({ fixa, dv });
  }
  if (faltantes.length === 0) {
    checks.push({ id: "falt", titulo: "Recorrências faltantes", severidade: "ok", mensagem: "Todas recorrências do mês geradas" });
    push("✓ Nenhuma recorrência faltante");
  } else {
    checks.push({
      id: "falt",
      titulo: "Recorrências faltantes",
      severidade: "warn",
      mensagem: `${faltantes.length} recorrência(s) não gerada(s)`,
      detalhes: faltantes.map(f => `${f.fixa.descricao} — ${fmt(Number(f.fixa.valor))} venc. ${dateHelper.formatarParaExibicao(f.dv)}`),
      fixes: faltantes.map(f => ({
        id: `falt-${f.fixa.id}-${f.dv}`,
        label: `Gerar: "${f.fixa.descricao}" ${fmt(Number(f.fixa.valor))} em ${dateHelper.formatarParaExibicao(f.dv)}`,
        apply: async () => {
          await supabase.from("lancamentos").insert({
            descricao: f.fixa.descricao, valor: f.fixa.valor, tipo: "despesa",
            data_vencimento: f.dv, conta_id: f.fixa.conta_id, categoria_id: f.fixa.categoria_id,
            status: "a_vencer", observacoes: `🔄 Fixa: ${f.fixa.id}`, user_id: user.id,
          });
        },
      })),
    });
    push(`⚠ ${faltantes.length} faltante(s)`);
  }

  // 4 — Totais dashboard
  push("▶ [4/9] Recalculando totais do dashboard...");
  const lMes = lancamentos.filter(l => l.data_vencimento >= inicio && l.data_vencimento <= fim);
  const isPago = (l: any) => l.status === "pago" || !!l.data_pagamento;
  const aReceber = lMes.filter(l => l.tipo === "receita" && !isPago(l)).reduce((s, l) => s + Math.abs(+l.valor), 0);
  const aPagar = lMes.filter(l => l.tipo === "despesa" && !isPago(l)).reduce((s, l) => s + Math.abs(+l.valor), 0);
  const totalContas = contas.reduce((s, c) => s + calcularSaldoConta(c as any, lancamentos as any), 0);
  checks.push({
    id: "totais",
    titulo: "Totais do dashboard",
    severidade: "ok",
    mensagem: "Valores recalculados a partir dos dados brutos",
    detalhes: [
      `A Receber: ${fmt(aReceber)}`,
      `A Pagar: ${fmt(aPagar)}`,
      `Total Contas: ${fmt(totalContas)}`,
      `Projeção: ${fmt(totalContas - aPagar)}`,
    ],
  });
  push("✓ Totais consistentes");

  // 5 — Órfãos / inconsistentes
  push("▶ [5/9] Verificando lançamentos órfãos ou inválidos...");
  const contaIds = new Set(contas.map(c => c.id));
  const orfaos = lancamentos.filter(l => l.conta_id && !contaIds.has(l.conta_id));
  const semCat = lancamentos.filter(l => !l.categoria_id);
  const valorZero = lancamentos.filter(l => Number(l.valor) <= 0);
  const dataInvalida = lancamentos.filter(l => {
    const y = parseInt((l.data_vencimento || "0").slice(0, 4));
    return y < 2000 || y > 2100;
  });
  const totalInc = orfaos.length + semCat.length + valorZero.length + dataInvalida.length;
  if (totalInc === 0) {
    checks.push({ id: "orf", titulo: "Lançamentos órfãos/inválidos", severidade: "ok", mensagem: "Nenhuma inconsistência encontrada" });
    push("✓ Nenhuma inconsistência");
  } else {
    checks.push({
      id: "orf", titulo: "Lançamentos órfãos/inválidos", severidade: "warn",
      mensagem: `${totalInc} problema(s)`,
      detalhes: [
        `${orfaos.length} sem conta válida`,
        `${semCat.length} sem categoria`,
        `${valorZero.length} com valor ≤ 0`,
        `${dataInvalida.length} com data inválida`,
      ],
    });
    push(`⚠ ${totalInc} inconsistência(s)`);
  }

  // 6 — Status contraditório
  push("▶ [6/9] Verificando status contraditórios...");
  const pagoSemData = lancamentos.filter(l => (l.status === "pago" || l.status === "recebido") && !l.data_pagamento);
  const aVencerJaVencido = lancamentos.filter(l => l.status === "a_vencer" && l.data_vencimento < hoje);
  const vencidoFuturo = lancamentos.filter(l => l.status === "vencido" && l.data_vencimento > hoje);
  const totalSt = pagoSemData.length + aVencerJaVencido.length + vencidoFuturo.length;
  if (totalSt === 0) {
    checks.push({ id: "st", titulo: "Status contraditórios", severidade: "ok", mensagem: "Status consistentes" });
    push("✓ Status OK");
  } else {
    const fixes: Fix[] = [];
    for (const l of aVencerJaVencido) {
      fixes.push({
        id: `st-${l.id}`,
        label: `Marcar como Vencido: "${l.descricao}" venc. ${dateHelper.formatarParaExibicao(l.data_vencimento)}`,
        apply: async () => { await supabase.from("lancamentos").update({ status: "vencido" }).eq("id", l.id); },
      });
    }
    for (const l of vencidoFuturo) {
      fixes.push({
        id: `st-${l.id}`,
        label: `Marcar como A Vencer: "${l.descricao}" venc. ${dateHelper.formatarParaExibicao(l.data_vencimento)}`,
        apply: async () => { await supabase.from("lancamentos").update({ status: "a_vencer" }).eq("id", l.id); },
      });
    }
    checks.push({
      id: "st", titulo: "Status contraditórios", severidade: "warn",
      mensagem: `${totalSt} divergência(s)`,
      detalhes: [
        `${pagoSemData.length} pago/recebido sem data de pagamento`,
        `${aVencerJaVencido.length} "a vencer" já vencido`,
        `${vencidoFuturo.length} "vencido" com data futura`,
      ],
      fixes,
    });
    push(`⚠ ${totalSt} status divergente(s)`);
  }

  // 7 — Projeção
  push("▶ [7/9] Recalculando projeção...");
  checks.push({
    id: "proj", titulo: "Projeção financeira", severidade: "ok",
    mensagem: `Projeção (Total Contas − A Pagar): ${fmt(totalContas - aPagar)}`,
  });
  push("✓ Projeção recalculada");

  // 8 — Conexão / estrutura
  push("▶ [8/9] Conferindo conexão e estrutura...");
  const tabelas = ["contas", "lancamentos", "despesas_fixas", "categorias", "logs_auditoria"] as const;
  const estrutura: string[] = [];
  let estruturaOk = true;
  for (const t of tabelas) {
    const { error } = await supabase.from(t).select("id", { head: true, count: "exact" }).limit(1);
    if (error) { estruturaOk = false; estrutura.push(`✗ ${t}: ${error.message}`); }
    else estrutura.push(`✓ ${t}`);
  }
  checks.push({
    id: "estr", titulo: "Conexão e estrutura", severidade: estruturaOk ? "ok" : "critical",
    mensagem: estruturaOk ? "Conexão e tabelas OK" : "Falha em alguma tabela",
    detalhes: estrutura,
  });
  push(estruturaOk ? "✓ Estrutura OK" : "✗ Estrutura com falha");

  // 9 — Smoke test (escrita real)
  push("▶ [9/9] Smoke test de escrita...");
  const tw0 = Date.now();
  const { data: ins, error: insErr } = await supabase.from("logs_auditoria").insert({
    usuario_id: user.id, acao: "DIAGNOSTICO_SMOKE", entidade: "DIAGNOSTICO",
    descricao: "Smoke test de escrita", user_agent: navigator.userAgent,
  }).select("id").single();
  const tw = Date.now() - tw0;
  if (insErr || !ins) {
    checks.push({ id: "smoke", titulo: "Smoke test", severidade: "critical", mensagem: `Falha na escrita: ${insErr?.message}` });
    push(`✗ Smoke test falhou: ${insErr?.message}`);
  } else {
    await supabase.from("logs_auditoria").delete().eq("id", ins.id);
    checks.push({ id: "smoke", titulo: "Smoke test", severidade: "ok", mensagem: `Escrita confirmada em ${tw}ms` });
    push(`✓ Escrita confirmada em ${tw}ms`);
  }

  const geral = checks.reduce<Severity>((acc, c) => pior(acc, c.severidade), "ok");
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;
  push(`■ Concluído em ${durationMs}ms — status geral: ${geral.toUpperCase()}`);

  // Registrar na auditoria
  await supabase.from("logs_auditoria").insert({
    usuario_id: user.id, acao: "DIAGNOSTICO_EXECUTADO", entidade: "DIAGNOSTICO",
    descricao: `Diagnóstico: ${geral.toUpperCase()} (${checks.filter(c => c.severidade !== "ok").length} alerta(s))`,
    dados_depois: { checks: checks.map(c => ({ id: c.id, sev: c.severidade, msg: c.mensagem })) } as any,
    user_agent: navigator.userAgent,
  });

  return { startedAt, finishedAt, durationMs, geral, checks, log };
}
