import { describe, expect, it } from "vitest";
import { calcularSaldoConta, calcularSaldoTodasContas } from "@/lib/saldoHelper";

const conta = {
  id: "conta-1",
  nome: "Caixa",
  saldo_inicial: 1000,
  ultima_alteracao_saldo: "2026-06-01",
};

describe("saldoHelper", () => {
  it("soma receitas quitadas e diminui despesas quitadas da conta correta", () => {
    const saldo = calcularSaldoConta(conta, [
      {
        conta_id: "conta-1",
        tipo: "receita",
        status: "recebido",
        valor: 500,
        data_vencimento: "2026-06-10",
      },
      {
        conta_id: "conta-1",
        tipo: "despesa",
        status: "pago",
        valor: 200,
        data_vencimento: "2026-06-11",
      },
      {
        conta_id: "conta-2",
        tipo: "despesa",
        status: "pago",
        valor: 900,
        data_vencimento: "2026-06-11",
      },
    ]);

    expect(saldo).toBe(1300);
  });

  it("considera lançamentos quitados por data de pagamento mesmo com status antigo", () => {
    const saldo = calcularSaldoConta(conta, [
      {
        conta_id: "conta-1",
        tipo: "receita",
        status: "a_vencer",
        valor: 100,
        data_vencimento: "2026-06-12",
        data_pagamento: "2026-06-12",
      },
      {
        conta_id: "conta-1",
        tipo: "despesa",
        status: "vencido",
        valor: 50,
        data_vencimento: "2026-06-13",
        data_pagamento: "2026-06-13",
      },
    ]);

    expect(saldo).toBe(1050);
  });

  it("ignora valores pendentes no saldo real da conta", () => {
    const saldo = calcularSaldoConta(conta, [
      {
        conta_id: "conta-1",
        tipo: "receita",
        status: "a_vencer",
        valor: 800,
        data_vencimento: "2026-06-14",
      },
      {
        conta_id: "conta-1",
        tipo: "despesa",
        status: "vencido",
        valor: 300,
        data_vencimento: "2026-06-15",
      },
    ]);

    expect(saldo).toBe(1000);
  });

  it("normaliza valores negativos pelo tipo para não inverter receita/despesa", () => {
    const saldo = calcularSaldoConta(conta, [
      {
        conta_id: "conta-1",
        tipo: "receita",
        status: "pago",
        valor: -100,
        data_vencimento: "2026-06-16",
      },
      {
        conta_id: "conta-1",
        tipo: "despesa",
        status: "pago",
        valor: -25,
        data_vencimento: "2026-06-17",
      },
    ]);

    expect(saldo).toBe(1075);
  });

  it("calcula o total entre contas respeitando as movimentações de cada conta", () => {
    const { saldoPorConta, saldoTotal } = calcularSaldoTodasContas(
      [
        conta,
        { id: "conta-2", nome: "Banco", saldo_inicial: 250, ultima_alteracao_saldo: "2026-06-01" },
      ],
      [
        { conta_id: "conta-1", tipo: "receita", status: "recebido", valor: 100, data_vencimento: "2026-06-02" },
        { conta_id: "conta-2", tipo: "despesa", status: "pago", valor: 50, data_vencimento: "2026-06-02" },
      ]
    );

    expect(saldoPorConta["conta-1"].saldo).toBe(1100);
    expect(saldoPorConta["conta-2"].saldo).toBe(200);
    expect(saldoTotal).toBe(1300);
  });
});