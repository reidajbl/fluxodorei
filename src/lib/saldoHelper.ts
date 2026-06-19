export function calcularSaldoConta(
  conta: { id: string; saldo_inicial: number | null; ultima_alteracao_saldo: string | null },
  todosLancamentos: { conta_id: string; tipo: string; status: string | null; valor: number; data_vencimento: string; data_pagamento?: string | null }[]
): number {
  let saldo = Number(conta.saldo_inicial || 0);

  const dataAlteracao = conta.ultima_alteracao_saldo || "1900-01-01";

  const lancamentosConta = todosLancamentos.filter((l) => {
    if (l.conta_id !== conta.id) return false;
    if (l.status !== "pago") return false;
    // Use a data em que o dinheiro efetivamente entrou/saiu da conta
    const dataEfetiva = l.data_pagamento || l.data_vencimento;
    // Estritamente maior: o saldo_inicial já reflete o dia do checkpoint
    return dataEfetiva > dataAlteracao;
  });

  for (const l of lancamentosConta) {
    if (l.tipo === "receita") {
      saldo += Number(l.valor);
    } else if (l.tipo === "despesa") {
      saldo -= Math.abs(Number(l.valor));
    }
  }

  return saldo;
}

export function calcularSaldoTodasContas(
  contas: any[],
  todosLancamentos: any[]
): { saldoPorConta: Record<string, any>; saldoTotal: number } {
  const saldoPorConta: Record<string, any> = {};
  let saldoTotal = 0;

  for (const conta of contas) {
    const saldo = calcularSaldoConta(conta, todosLancamentos);
    saldoPorConta[conta.id] = {
      nome: conta.nome,
      saldo,
      icone: conta.icone || "💰",
      cor: conta.cor || "#3b82f6",
      ultima_alteracao_saldo: conta.ultima_alteracao_saldo,
    };
    saldoTotal += saldo;
  }

  return { saldoPorConta, saldoTotal };
}
