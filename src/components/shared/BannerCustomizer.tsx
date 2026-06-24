import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Palette, Upload, Check, Loader2 } from "lucide-react";
import { useBannerPreference } from "@/contexts/BannerPreferenceContext";
import { toast } from "@/components/ui/sonner";

export const BANNER_PRESETS = [
  { id: "preset-1", label: "Azul & Laranja" },
  { id: "preset-2", label: "Roxo & Rosa" },
  { id: "preset-3", label: "Ciano & Azul" },
  { id: "preset-4", label: "Verde & Roxo" },
  { id: "preset-5", label: "Grafite" },
  { id: "preset-6", label: "Carmim & Âmbar" },
];

const BannerCustomizer = () => {
  const { pref, setPreset, uploadImagem } = useBannerPreference();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    setUploading(true);
    try {
      await uploadImagem(file);
      toast.success("Fundo atualizado!");
      setOpen(false);
    } catch (err: any) {
      toast.error("Falha no upload: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePreset = async (id: string) => {
    await setPreset(id);
    toast.success("Fundo atualizado!");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur">
          <Palette className="h-4 w-4 mr-1.5" /> Personalizar fundo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Personalizar fundo do banner</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Presets</p>
            <div className="grid grid-cols-3 gap-2">
              {BANNER_PRESETS.map(p => {
                const active = pref.banner_tipo === "preset" && pref.banner_valor === p.id;
                return (
                  <button key={p.id} onClick={() => handlePreset(p.id)}
                    className={`relative h-20 rounded-lg overflow-hidden border-2 transition ${active ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-border"} banner-${p.id}`}>
                    {active && <Check className="absolute top-1 right-1 h-4 w-4 text-white drop-shadow" />}
                    <span className="absolute bottom-1 left-2 text-[10px] font-semibold text-white drop-shadow">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Imagem personalizada</p>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {uploading ? "Enviando..." : "Enviar imagem (max 5MB)"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">
              Um overlay escuro é aplicado automaticamente para garantir legibilidade do texto branco.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BannerCustomizer;
