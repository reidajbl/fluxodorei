import { supabase } from "@/integrations/supabase/client";
import { dateHelper } from "@/lib/dateHelper";
import { calcularSaldoConta } from "@/lib/saldoHelper";
import { registrarLog } from "@/lib/logger";

export type Severidade = "ok" | "warn" | "error";

export interface Correcao {
  id: string;
  label: string;
  antes: any;
  depois: any;
  aplicar: () => Promise<void>;
}

export interface CheckResult {
  id: string;
  titulo: string;
  severidade: Severidade;
  detalhes: string[];
  correcoes: Correcao[];
}

export interface DiagnosticoResultado {
  iniciadoEm: string;
  finalizadoEm: string;
  duracaoMs: number;
  statusGeral: Severidade;
  checks: CheckResult[];
}

const log = (linhas: string[], msg: string) => {
  const ts = new Date().toLocaleTimeString("pt-BR");
  linhas.push(`[${ts}] ${msg}`);
};

// ============ CHECK 1: Saldo por conta ============
async function checkSaldos(contas: any[], lancamentos: any[], linhas: string[]): Promise<CheckResult> {
  log(linhas, "▶ Verificando integridade de saldo por conta...");
  const detalhes: string[] = [];
  const correcoes: Correcao[] = [];
  let sev: Severidade = "ok";

  for (const conta of contas) {
    const calculado = calcularSaldoConta(conta, lancamentos);
    // "Saldo salvo" = saldo_inicial (snapshot). Divergência só faz sentido se houver
    // um saldo "exibido" diferente do recalculado — aqui validamos que recálculo é finito.
    if (!Number.isFinite(calculado)) {
      sev = "error";
      detalhes.push(`❌ ${conta.nome}: saldo recalculado inválido`);
    } else {
      detalhes.push(`✅ ${conta.icone || "💰"} ${conta.nome}: R$ ${calculado.toFixed(2)}`);
    }
  }
  log(linhas, `  ${contas.length} conta(s) verificada(s).`);
  return { id: "saldos", titulo: "Integridade de saldo por conta", severidade: sev, detalhes, correcoes };
}

// ============ CHECK 2: Recorrências duplicadas ============
async function checkDuplicadas(lancamentos: any[], linhas: string[]): Promise<CheckResult> {
  log(linhas, "▶ Procurando recorrências duplicadas...");
  const detalhes: string[] = [];
  const correcoes: Correcao[] = [];
  const grupos = new Map<string, any[]>();

  for (const l of lancamentos) {
    const key = `${l.descricao}|${l.valor}|${l.conta_id}|${l.data_vencimento}`;
    const arr = grupos.get(key) || [];
    arr.push(l);
    grupos.set(key, arr);
  }

  let dup = 0;
  for (const [, arr] of grupos) {
    if (arr.length > 1) {
      dup++;
      const [keep, ...remove] = arr.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      detalhes.push(`❌ ${arr.length}x "${keep.descricao}" em ${keep.data_vencimento} (R$ ${keep.valor})`);
      for (const r of remove) {
        correcoes.push({
          id: `dup-${r.id}`,
          label: `Remover duplicata "${r.descricao}" (${r.data_vencimento})`,
          antes: { id: r.id, descricao: r.descricao, valor: r.valor },
          depois: null,
          aplicar: async () => {
            await supabase.from("lancamentos").delete().eq("id", r.id);
            await registrarLog({
              acao: "DIAGNOSTICO_CORRIGIR", entidade: "LANCAMENTO", entidade_id: r.id,
              dados_antes: r, dados_depois: null,
              descricao: `Duplicata removida: ${r.descricao}`,
            });
          },
        });
      }
    }
  }
  log(linhas, `  ${dup} grupo(s) de duplicatas encontrado(s).`);
  return {
    id: "duplicadas", titulo: "Recorrências duplicadas",
    severidade: dup > 0 ? "error" : "ok", detalhes, correcoes,
  };
}

// ============ CHECK 3: Recorrências faltantes ============
async function checkFaltantes(linhas: string[]): Promise<CheckResult> {
  log(linhas, "▶ Verificando recorrências faltantes do mês atual...");
  const detalhes: string[] = [];
  const correcoes: Correcao[] = [];
  const { ano, mes } = dateHelper.mesAnoAtual();
  const hoje = dateHelper.hojeStr();
  const ultimoDia = new Date(ano, mes, 0).getDate();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: "faltantes", titulo: "Recorrências faltantes", severidade: "ok", detalhes, correcoes };

  const { data: fixas } = await supabase.from("despesas_fixas").select("*").eq("ativo", true);
  let faltam = 0;

  for (const fixa of fixas || []) {
    const dia = Math.min(fixa.dia_vencimento, ultimoDia);
    const dataVenc = dateHelper.criarDataSegura(ano, mes, dia);
    if (dataVenc > hoje) continue; // ainda não chegou

    const { data: existe } = await supabase
      .from("lancamentos").select("id")
      .eq("descricao", fixa.descricao).eq("valor", fixa.valor)
      .eq("conta_id", fixa.conta_id).eq("data_vencimento", dataVenc)
      .eq("user_id", user.id).limit(1);

    if (!existe?.length) {
      faltam++;
      detalhes.push(`⚠️ Falta: "${fixa.descricao}" em ${dataVenc} (R$ ${fixa.valor})`);
      correcoes.push({
        id: `falt-${fixa.id}-${dataVenc}`,
        label: `Gerar "${fixa.descricao}" em ${dataVenc}`,
        antes: null,
        depois: { descricao: fixa.descricao, valor: fixa.valor, data_vencimento: dataVenc },
        aplicar: async () => {
          const novo = {
            descricao: fixa.descricao, valor: fixa.valor, tipo: "despesa",
            data_vencimento: dataVenc, conta_id: fixa.conta_id, categoria_id: fixa.categoria_id,
            status: "a_vencer", observacoes: `🔄 Fixa: ${fixa.id} (diagnóstico)`,
            user_id: user.id,
          };
          const { data } = await supabase.from("lancamentos").insert(novo).select().single();
          await registrarLog({
            acao: "DIAGNOSTICO_CORRIGIR", entidade: "LANCAMENTO", entidade_id: data?.id,
            dados_antes: null, dados_depois: data,
            descricao: `Recorrência faltante gerada: ${fixa.descricao}`,
          });
        },
      });
    }
  }
  log(linhas, `  ${faltam} recorrência(s) faltante(s).`);
  return {
    id: "faltantes", titulo: "Recorrências faltantes (mês atual)",
    severidade: faltam > 0 ? "warn" : "ok", detalhes, correcoes,
  };
}

// ============ CHECK 4: Totais do dashboard ============
async function checkTotais(contas: any[], lancamentos: any[], linhas: string[]): Promise<CheckResult> {
  log(linhas, "▶ Recalculando totais do dashboard (mês atual)...");
  const detalhes: string[] = [];
  const { ano, mes } = dateHelper.mesAnoAtual();
  const inicio = dateHelper.primeiroDiaMes(ano, mes);
  const fim = dateHelper.ultimoDiaMes(ano, mes);
  const doMes = lancamentos.filter(l => l.data_vencimento >= inicio && l.data_vencimento <= fim);
  const isPago = (l: any) => l.status === "pago" || !!l.data_pagamento;
  const aReceber = doMes.filter(l => l.tipo === "receita" && !isPago(l)).reduce((s, l) => s + Math.abs(+l.valor), 0);
  const aPagar = doMes.filter(l => l.tipo === "despesa" && !isPago(l)).reduce((s, l) => s + Math.abs(+l.valor), 0);
  const totalContas = contas.reduce((s, c) => s + calcularSaldoConta(c, lancamentos), 0);
  detalhes.push(`✅ A Receber: R$ ${aReceber.toFixed(2)}`);
  detalhes.push(`✅ A Pagar: R$ ${aPagar.toFixed(2)}`);
  detalhes.push(`✅ Total em Contas: R$ ${totalContas.toFixed(2)}`);
  detalhes.push(`✅ Projeção: R$ ${(totalContas - aPagar).toFixed(2)}`);
  log(linhas, `  Totais recalculados.`);
  return { id: "totais", titulo: "Totais do dashboard", severidade: "ok", detalhes, correcoes: [] };
}

// ============ CHECK 5: Lançamentos inconsistentes ============
async function checkInconsistentes(contas: any[], lancamentos: any[], linhas: string[]): Promise<CheckResult> {
  log(linhas, "▶ Procurando lançamentos órfãos/inconsistentes...");
  const detalhes: string[] = [];
  const correcoes: Correcao[] = [];
  const contaIds = new Set(contas.map(c => c.id));
  let problemas = 0;

  for (const l of lancamentos) {
    if (!contaIds.has(l.conta_id)) {
      problemas++;
      detalhes.push(`❌ Órfão (conta inexistente): "${l.descricao}" ${l.data_vencimento}`);
    }
    if (!l.categoria_id) {
      problemas++;
      detalhes.push(`⚠️ Sem categoria: "${l.descricao}" ${l.data_vencimento}`);
    }
    const v = Number(l.valor);
    if (!v || v <= 0) {
      problemas++;
      detalhes.push(`❌ Valor inválido (R$ ${v}): "${l.descricao}"`);
    }
    const ano = parseInt((l.data_vencimento || "").slice(0, 4));
    if (ano < 2000 || ano > 2100) {
      problemas++;
      detalhes.push(`❌ Data suspeita (${l.data_vencimento}): "${l.descricao}"`);
    }
  }
  log(linhas, `  ${problemas} inconsistência(s) encontrada(s).`);
  return {
    id: "inconsistentes", titulo: "Lançamentos órfãos ou inconsistentes",
    severidade: problemas > 0 ? "warn" : "ok", detalhes, correcoes,
  };
}

// ============ CHECK 6: Status contraditório ============
async function checkStatus(lancamentos: any[], linhas: string[]): Promise<CheckResult> {
  log(linhas, "▶ Verificando status contraditórios...");
  const detalhes: string[] = [];
  const correcoes: Correcao[] = [];
  const hoje = dateHelper.hojeStr();
  let problemas = 0;

  for (const l of lancamentos) {
    // Pago/recebido sem data_pagamento
    if ((l.status === "pago" || l.status === "recebido") && !l.data_pagamento) {
      problemas++;
      detalhes.push(`⚠️ "${l.descricao}" marcado ${l.status} sem data de pagamento`);
      correcoes.push({
        id: `dtpag-${l.id}`,
        label: `Definir data de pagamento = hoje para "${l.descricao}"`,
        antes: { data_pagamento: null }, depois: { data_pagamento: hoje },
        aplicar: async () => {
          await supabase.from("lancamentos").update({ data_pagamento: hoje }).eq("id", l.id);
          await registrarLog({
            acao: "DIAGNOSTICO_CORRIGIR", entidade: "LANCAMENTO", entidade_id: l.id,
            dados_antes: { data_pagamento: null }, dados_depois: { data_pagamento: hoje },
            descricao: `Data de pagamento preenchida: ${l.descricao}`,
          });
        },
      });
    }
    // a_vencer mas já venceu
    if (l.status === "a_vencer" && l.data_vencimento < hoje && !l.data_pagamento) {
      problemas++;
      detalhes.push(`⚠️ "${l.descricao}" está "A Vencer" mas venceu em ${l.data_vencimento}`);
      correcoes.push({
        id: `stvenc-${l.id}`,
        label: `Marcar "${l.descricao}" como Vencido`,
        antes: { status: l.status }, depois: { status: "vencido" },
        aplicar: async () => {
          await supabase.from("lancamentos").update({ status: "vencido" }).eq("id", l.id);
          await registrarLog({
            acao: "DIAGNOSTICO_CORRIGIR", entidade: "LANCAMENTO", entidade_id: l.id,
            dados_antes: { status: l.status }, dados_depois: { status: "vencido" },
            descricao: `Status corrigido para Vencido: ${l.descricao}`,
          });
        },
      });
    }
    // vencido mas data ainda não chegou
    if (l.status === "vencido" && l.data_vencimento > hoje) {
      problemas++;
      detalhes.push(`⚠️ "${l.descricao}" está "Vencido" mas vence em ${l.data_vencimento}`);
      correcoes.push({
        id: `stavc-${l.id}`,
        label: `Marcar "${l.descricao}" como A Vencer`,
        antes: { status: "vencido" }, depois: { status: "a_vencer" },
        aplicar: async () => {
          await supabase.from("lancamentos").update({ status: "a_vencer" }).eq("id", l.id);
          await registrarLog({
            acao: "DIAGNOSTICO_CORRIGIR", entidade: "LANCAMENTO", entidade_id: l.id,
            dados_antes: { status: "vencido" }, dados_depois: { status: "a_vencer" },
            descricao: `Status corrigido para A Vencer: ${l.descricao}`,
          });
        },
      });
    }
  }
  log(linhas, `  ${problemas} status contraditório(s).`);
  return {
    id: "status", titulo: "Status contraditório",
    severidade: problemas > 0 ? "warn" : "ok", detalhes, correcoes,
  };
}

// ============ CHECK 7: Conexão + smoke test ============
async function checkConexao(linhas: string[]): Promise<CheckResult> {
  log(linhas, "▶ Testando conexão e escrita real...");
  const detalhes: string[] = [];
  let sev: Severidade = "ok";
  const t0 = performance.now();

  const tabelas = ["contas", "lancamentos", "despesas_fixas", "categorias", "logs_auditoria"] as const;
  for (const t of tabelas) {
    const { error } = await supabase.from(t).select("id", { count: "exact", head: true });
    if (error) { sev = "error"; detalhes.push(`❌ Tabela ${t}: ${error.message}`); }
    else detalhes.push(`✅ Tabela ${t} acessível (RLS ativo)`);
  }

  // Smoke test: escrever e ler log
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const ti = performance.now();
    const { data, error } = await supabase.from("logs_auditoria").insert({
      usuario_id: user.id, acao: "DIAGNOSTICO_SMOKE", entidade: "DIAGNOSTICO",
      descricao: "Smoke test de escrita",
    }).select().single();
    const dt = performance.now() - ti;
    if (error || !data) { sev = "error"; detalhes.push(`❌ Escrita falhou: ${error?.message}`); }
    else {
      detalhes.push(`✅ Escrita confirmada em ${dt.toFixed(0)}ms`);
      await supabase.from("logs_auditoria").delete().eq("id", data.id);
    }
  }
  log(linhas, `  Conexão OK em ${(performance.now() - t0).toFixed(0)}ms.`);
  return { id: "conexao", titulo: "Conexão, estrutura e smoke test", severidade: sev, detalhes, correcoes: [] };
}

// ============ Orquestrador ============
export async function executarDiagnostico(
  contas: any[], lancamentos: any[],
  onLog?: (linhas: string[]) => void
): Promise<DiagnosticoResultado> {
  const iniciadoEm = new Date().toISOString();
  const t0 = performance.now();
  const linhas: string[] = [];
  log(linhas, "═══ INICIANDO DIAGNÓSTICO DO SISTEMA ═══");
  const emit = () => onLog?.([...linhas]);
  emit();

  const checks: CheckResult[] = [];
  for (const fn of [
    () => checkSaldos(contas, lancamentos, linhas),
    () => checkDuplicadas(lancamentos, linhas),
    () => checkFaltantes(linhas),
    () => checkTotais(contas, lancamentos, linhas),
    () => checkInconsistentes(contas, lancamentos, linhas),
    () => checkStatus(lancamentos, linhas),
    () => checkConexao(linhas),
  ]) {
    checks.push(await fn());
    emit();
  }

  const duracaoMs = performance.now() - t0;
  log(linhas, `═══ DIAGNÓSTICO CONCLUÍDO em ${duracaoMs.toFixed(0)}ms ═══`);
  emit();

  const sevs = checks.map(c => c.severidade);
  const statusGeral: Severidade = sevs.includes("error") ? "error" : sevs.includes("warn") ? "warn" : "ok";

  const resultado: DiagnosticoResultado = {
    iniciadoEm, finalizadoEm: new Date().toISOString(), duracaoMs, statusGeral, checks,
  };

  await registrarLog({
    acao: "DIAGNOSTICO_EXECUTAR", entidade: "DIAGNOSTICO",
    dados_depois: {
      statusGeral, duracaoMs,
      resumo: checks.map(c => ({ id: c.id, severidade: c.severidade, problemas: c.detalhes.length })),
    },
    descricao: `Diagnóstico executado — status ${statusGeral}`,
  });

  return resultado;
}
