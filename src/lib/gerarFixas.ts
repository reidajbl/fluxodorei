import { supabase } from "@/integrations/supabase/client";
import { dateHelper } from "@/lib/dateHelper";
import { toast } from "@/components/ui/sonner";
import { registrarLog } from "@/lib/logger";

export async function gerarFixasParaMes(ano: number, mes: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const ultimoDia = new Date(ano, mes, 0).getDate();
  const inicio = dateHelper.primeiroDiaMes(ano, mes);
  const fim = dateHelper.ultimoDiaMes(ano, mes);

  const { data: fixas } = await supabase
    .from("despesas_fixas")
    .select("*")
    .eq("ativo", true);

  if (!fixas?.length) return 0;

  let geradas = 0;

  for (const fixa of fixas) {
    // Check period validity
    if (fixa.data_inicio > fim) continue;
    if (fixa.data_fim && fixa.data_fim < inicio) continue;

    // Adjust day for short months
    const dia = Math.min(fixa.dia_vencimento, ultimoDia);
    const dataVencimento = dateHelper.criarDataSegura(ano, mes, dia);

    // Check if already exists (by description + value + date)
    const { data: existente } = await supabase
      .from("lancamentos")
      .select("id")
      .eq("descricao", fixa.descricao)
      .eq("valor", fixa.valor)
      .eq("data_vencimento", dataVencimento)
      .eq("user_id", user.id)
      .limit(1);

    if (existente && existente.length > 0) continue;

    const { error } = await supabase.from("lancamentos").insert({
      descricao: fixa.descricao,
      valor: fixa.valor,
      tipo: "despesa",
      data_vencimento: dataVencimento,
      conta_id: fixa.conta_id,
      categoria_id: fixa.categoria_id,
      status: "a_vencer",
      observacoes: `🔄 Fixa: ${fixa.id}`,
      user_id: user.id,
    });

    if (!error) {
      geradas++;
    }
  }

  if (geradas > 0) {
    await registrarLog({
      acao: "GERAR_FIXAS", entidade: "LANCAMENTO",
      descricao: `${geradas} despesa(s) fixa(s) gerada(s) para ${String(mes).padStart(2, "0")}/${ano}`,
    });
  }

  return geradas;
}
