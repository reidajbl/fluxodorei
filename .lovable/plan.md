## Objetivo
Refazer apenas a camada visual do app (sidebar, banner de topo, cards, listas) em todas as páginas, preservando 100% da lógica atual (cálculos, geração de fixas, diagnóstico, logs, RLS).

## Mudanças

### 1. Backend (Lovable Cloud)
- **Migration**: nova tabela `public.preferencias_usuario`
  - `user_id uuid PK references auth.users`, `banner_tipo text check in ('preset','imagem')`, `banner_valor text`, `updated_at timestamptz default now()`
  - GRANTs para `authenticated`/`service_role`, RLS: cada usuário só lê/escreve sua própria linha
- **Storage bucket** `banners` (público leitura) com policies em `storage.objects`:
  - SELECT público
  - INSERT/UPDATE/DELETE: somente quando `(storage.foldername(name))[1] = auth.uid()::text`

### 2. Componentes novos
- `src/components/shared/PageBanner.tsx` — banner escuro reutilizável, props: `title`, `subtitle?`, `indicators?` (array de {label, value, variation?})
  - Sempre fundo escuro/abstrato; texto branco
  - Botão "Personalizar fundo" → abre `BannerCustomizer`
- `src/components/shared/BannerCustomizer.tsx` — Dialog com 6 presets (gradientes escuros com blobs/blur) + upload de imagem
- `src/components/shared/KpiCard.tsx` — card de KPI com label uppercase, número grande, badge de variação
- `src/components/shared/ListRow.tsx` — linha de lista padrão (ícone à esquerda, nome centro, valor direita)
- `src/contexts/BannerPreferenceContext.tsx` — carrega/salva preferência via Supabase, exposta globalmente para refletir sem reload

### 3. Refatoração do layout
- `DashboardLayout.tsx`: 
  - Migrar para `Sidebar` do shadcn (collapsible icon, item ativo destacado, avatar+logout no rodapé), acompanha tema claro/escuro
  - Renderiza `<PageBanner>` no topo automaticamente; páginas registram título via prop (`<DashboardLayout title="..." indicators={...}>`)
- Todas as páginas (`Dashboard`, `Contas`, `DespesasFixas`, `Relatorios`, `Configuracoes`, `LogsAuditoria`, `Diagnostico`) passam a receber `title`/`indicators` ao layout; remove banners locais duplicados
- Substituir cards de KPI atuais por `KpiCard`
- Aplicar `ListRow` em listas existentes mantendo handlers (editar/excluir/filtros) intactos

### 4. Tokens de design
- `src/index.css`: adicionar tokens semânticos para sidebar (já existem), cards (radius/shadow sutil), e classes utilitárias para os 6 presets de banner (`.banner-preset-1` ... `.banner-preset-6`) com gradientes radiais/conic + blur
- Garantir contraste em ambos os temas; banner sempre força tokens escuros próprios

### 5. Fora de escopo (não mudar)
- Rotas, nomes de páginas, lógica de `saldoHelper`, `gerarFixas`, `diagnostico`, contexts de dados, RLS de outras tabelas
- Comportamento de filtros/busca/abas/CRUD — só a casca visual

## Detalhes técnicos
- Preferência aplicada via CSS var `--banner-bg` setada no root pelo context (sem reload)
- Upload: caminho `banners/{user_id}/{timestamp}-{nome}`; URL pública salva em `banner_valor`
- Overlay escuro `bg-black/40` automático sobre imagens uploadadas para legibilidade
- Sidebar usa `SidebarProvider` + `NavLink` (padrão shadcn) substituindo a implementação manual atual

Confirma para eu implementar?