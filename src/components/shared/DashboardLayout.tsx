import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Wallet, BarChart3, LogOut, TrendingUp, Menu, X,
  RefreshCw, Settings, ClipboardList, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useState } from "react";
import PageBanner, { BannerIndicator } from "./PageBanner";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/despesas-fixas", label: "Despesas Fixas", icon: RefreshCw },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/logs", label: "Auditoria", icon: ClipboardList },
  { href: "/diagnostico", label: "Diagnóstico", icon: ShieldCheck },
];

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  indicators?: BannerIndicator[];
  bannerRight?: ReactNode;
  hideBanner?: boolean;
}

const DashboardLayout = ({ children, title, subtitle, indicators, bannerRight, hideBanner }: DashboardLayoutProps) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const currentLabel = navItems.find(i => i.href === location.pathname)?.label;
  const resolvedTitle = title ?? currentLabel ?? "FLUXO REI JBL";

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
          <TrendingUp className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-sm text-sidebar-foreground">FLUXO REI JBL</h1>
          <p className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">{user?.email}</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-sidebar-foreground/60">Tema</span>
          <ThemeToggle />
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <TrendingUp className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-sm text-sidebar-foreground">FLUXO REI JBL</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 w-64 bg-sidebar flex flex-col h-full">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex">
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
          <SidebarContent />
        </aside>

        <main className="flex-1 lg:ml-64 min-h-screen overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 space-y-5">
            {!hideBanner && (
              <PageBanner title={resolvedTitle} subtitle={subtitle} indicators={indicators} rightSlot={bannerRight} />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
