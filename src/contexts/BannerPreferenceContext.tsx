import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type BannerTipo = "preset" | "imagem";

export interface BannerPreference {
  banner_tipo: BannerTipo;
  banner_valor: string; // preset id (e.g. "preset-1") OR storage path "user_id/file.png"
}

interface Ctx {
  pref: BannerPreference;
  imageUrl: string | null; // resolved signed URL when tipo === 'imagem'
  setPreset: (preset: string) => Promise<void>;
  uploadImagem: (file: File) => Promise<void>;
  loading: boolean;
}

const DEFAULT: BannerPreference = { banner_tipo: "preset", banner_valor: "preset-1" };

const BannerPreferenceContext = createContext<Ctx | null>(null);

export const useBannerPreference = () => {
  const ctx = useContext(BannerPreferenceContext);
  if (!ctx) throw new Error("useBannerPreference must be used inside BannerPreferenceProvider");
  return ctx;
};

export const BannerPreferenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [pref, setPref] = useState<BannerPreference>(DEFAULT);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveImage = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from("banners").createSignedUrl(path, 60 * 60 * 24 * 365);
    setImageUrl(data?.signedUrl ?? null);
  }, []);

  // Load preference
  useEffect(() => {
    if (!user) { setPref(DEFAULT); setImageUrl(null); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("preferencias_usuario")
        .select("banner_tipo, banner_valor")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPref(data);
        if (data.banner_tipo === "imagem" && data.banner_valor) await resolveImage(data.banner_valor);
        else setImageUrl(null);
      } else {
        setPref(DEFAULT);
        setImageUrl(null);
      }
      setLoading(false);
    })();
  }, [user, resolveImage]);

  const upsert = async (next: BannerPreference) => {
    if (!user) return;
    await (supabase as any)
      .from("preferencias_usuario")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    setPref(next);
  };

  const setPreset = useCallback(async (preset: string) => {
    await upsert({ banner_tipo: "preset", banner_valor: preset });
    setImageUrl(null);
  }, [user]);

  const uploadImagem = useCallback(async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
    if (error) throw error;
    await upsert({ banner_tipo: "imagem", banner_valor: path });
    await resolveImage(path);
  }, [user, resolveImage]);

  return (
    <BannerPreferenceContext.Provider value={{ pref, imageUrl, setPreset, uploadImagem, loading }}>
      {children}
    </BannerPreferenceContext.Provider>
  );
};
