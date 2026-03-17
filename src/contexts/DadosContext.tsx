import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DadosContextType {
  contas: any[];
  lancamentos: any[];
  loading: boolean;
  refresh: () => Promise<void>;
  buscarDados: (forcarRefresh?: boolean) => Promise<void>;
}

const DadosContext = createContext<DadosContextType>({
  contas: [],
  lancamentos: [],
  loading: false,
  refresh: async () => {},
  buscarDados: async () => {},
});

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const DadosProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const cache = useRef<{ contas: any[] | null; lancamentos: any[] | null; ts: number }>({
    contas: null,
    lancamentos: null,
    ts: 0,
  });

  const [contas, setContas] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const buscarDados = useCallback(async (forcarRefresh = false) => {
    if (!user) return;

    const agora = Date.now();
    if (
      !forcarRefresh &&
      cache.current.contas &&
      cache.current.lancamentos &&
      agora - cache.current.ts < CACHE_TTL
    ) {
      console.log("📦 Usando cache (menos de 5 minutos)");
      setContas(cache.current.contas);
      setLancamentos(cache.current.lancamentos);
      return;
    }

    setLoading(true);
    console.log("🔄 Buscando dados do banco...");

    const [contasRes, lancamentosRes] = await Promise.all([
      supabase.from("contas").select("*").eq("ativo", true),
      supabase
        .from("lancamentos")
        .select("*, categorias(nome, cor), contas(nome, icone)")
        .order("data_vencimento", { ascending: true }),
    ]);

    const c = contasRes.data || [];
    const l = lancamentosRes.data || [];

    cache.current = { contas: c, lancamentos: l, ts: Date.now() };
    setContas(c);
    setLancamentos(l);
    setLoading(false);
  }, [user]);

  const refresh = useCallback(async () => {
    console.log("🔄 Forçando atualização do banco...");
    await buscarDados(true);
  }, [buscarDados]);

  // Load on user change
  useEffect(() => {
    if (user) {
      buscarDados(true);
    } else {
      cache.current = { contas: null, lancamentos: null, ts: 0 };
      setContas([]);
      setLancamentos([]);
    }
  }, [user]);

  // Realtime subscription for auto-refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dados-cache-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => {
        buscarDados(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contas" }, () => {
        buscarDados(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, buscarDados]);

  return (
    <DadosContext.Provider value={{ contas, lancamentos, loading, refresh, buscarDados }}>
      {children}
    </DadosContext.Provider>
  );
};

export const useDados = () => useContext(DadosContext);
