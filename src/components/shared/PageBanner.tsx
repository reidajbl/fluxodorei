import { ReactNode } from "react";
import { useBannerPreference } from "@/contexts/BannerPreferenceContext";
import BannerCustomizer from "./BannerCustomizer";
import { cn } from "@/lib/utils";

export interface BannerIndicator {
  label: string;
  value: string;
  variation?: { value: string; positive?: boolean };
}

interface PageBannerProps {
  title: string;
  subtitle?: string;
  indicators?: BannerIndicator[];
  rightSlot?: ReactNode;
}

const PageBanner = ({ title, subtitle, indicators, rightSlot }: PageBannerProps) => {
  const { pref, imageUrl } = useBannerPreference();
  const presetClass = pref.banner_tipo === "preset" ? `banner-${pref.banner_valor}` : "banner-preset-1";
  const useImage = pref.banner_tipo === "imagem" && imageUrl;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-5 md:p-7 text-white shadow-lg", !useImage && presetClass)}
         style={useImage ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      {useImage && <div className="absolute inset-0 bg-black/55" />}
      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {subtitle && <p className="text-xs font-medium uppercase tracking-wider text-white/70 mb-1">{subtitle}</p>}
          <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-sm">{title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          <BannerCustomizer />
        </div>
      </div>
      {indicators && indicators.length > 0 && (
        <div className="relative mt-5 grid gap-3 grid-cols-2 md:grid-cols-4">
          {indicators.map((ind, i) => (
            <div key={i} className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{ind.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg md:text-xl font-bold text-white truncate">{ind.value}</span>
                {ind.variation && (
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    ind.variation.positive ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200")}>
                    {ind.variation.value}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageBanner;
