import { supabase } from "@/integrations/supabase/client";

interface LogParams {
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  dados_antes?: any;
  dados_depois?: any;
  descricao: string;
}

export async function registrarLog({ acao, entidade, entidade_id = null, dados_antes = null, dados_depois = null, descricao }: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any).from("logs_auditoria").insert({
      usuario_id: user.id,
      acao,
      entidade,
      entidade_id,
      dados_antes,
      dados_depois,
      descricao,
      user_agent: navigator.userAgent,
    });

    console.log("📝 LOG:", descricao);
  } catch (error) {
    console.error("Erro ao registrar log:", error);
  }
}
