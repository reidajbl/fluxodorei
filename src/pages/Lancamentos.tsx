import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import LancamentosLista from "@/components/LancamentosLista";
import { dateHelper } from "@/lib/dateHelper";

const Lancamentos = () => {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [tiposRecebimento, setTiposRecebimento] = useState<any[]>([]);

  const { ano: anoAtual, mes: mesAtual } = dateHelper.mesAnoAtual();
  const [mesView, setMesView] = useState(mesAtual);
  const [anoView, setAnoView] = useState(anoAtual);

  const mesAnterior = () => { if (mesView === 1) { setMesView(12); setAnoView(anoView - 1); } else setMesView(mesView - 1); };
  const mesProximo = () => { if (mesView === 12) { setMesView(1); setAnoView(anoView + 1); } else setMesView(mesView + 1); };
  const mesAtualBtn = () => { setMesView(mesAtual); setAnoView(anoAtual); };

  const fetchData = async () => {
    if (!user) return;
    const inicio = dateHelper.primeiroDiaMes(anoView, mesView);
    const fim = dateHelper.ultimoDiaMes(anoView, mesView);
    const [{ data: l }, { data: c }, { data: cat }] = await Promise.all([
      supabase.from("lancamentos").select("*, categorias(nome, cor), contas(nome, icone)")
        .gte("data_vencimento", inicio).lte("data_vencimento", fim)
        .order("data_vencimento", { ascending: false }),
      supabase.from("contas").select("*").eq("ativo", true),
      supabase.from("categorias").select("*"),
    ]);
    if (l) setLancamentos(l);
    if (c) setContas(c);
    if (cat) setCategorias(cat);
  };

  useEffect(() => { fetchData(); }, [user, mesView, anoView]);

  return (
    <DashboardLayout>
      <LancamentosLista
        lancamentos={lancamentos}
        contas={contas}
        categorias={categorias}
        mesView={mesView}
        anoView={anoView}
        onMesAnterior={mesAnterior}
        onMesProximo={mesProximo}
        onMesAtual={mesAtualBtn}
        onRefresh={fetchData}
        showNewButtons={true}
      />
    </DashboardLayout>
  );
};

export default Lancamentos;
