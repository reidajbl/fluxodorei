import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  variation?: { value: string; positive?: boolean };
  accent?: "default" | "success" | "destructive" | "info" | "warning";
}

const accentMap = {
  default: "",
  success: "text-success",
  destructive: "text-destructive",
  info: "text-info",
  warning: "text-warning",
};

const KpiCard = ({ label, value, icon, variation, accent = "default" }: KpiCardProps) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold", accentMap[accent])}>{value}</span>
        {variation && (
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            variation.positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
            {variation.value}
          </span>
        )}
      </div>
    </CardContent>
  </Card>
);

export default KpiCard;
