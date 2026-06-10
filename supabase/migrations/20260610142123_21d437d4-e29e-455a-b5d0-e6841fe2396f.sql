
-- 1) Add user_id ownership to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill: assign each empresa to the user that owns related rows, if any
UPDATE public.empresas e
SET user_id = sub.user_id
FROM (
  SELECT empresa_id, user_id FROM public.contas WHERE empresa_id IS NOT NULL
  UNION
  SELECT empresa_id, user_id FROM public.lancamentos WHERE empresa_id IS NOT NULL
  UNION
  SELECT empresa_id, user_id FROM public.categorias WHERE empresa_id IS NOT NULL
  UNION
  SELECT empresa_id, user_id FROM public.despesas_fixas WHERE empresa_id IS NOT NULL
) sub
WHERE e.id = sub.empresa_id AND e.user_id IS NULL;

-- Drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can delete empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can insert empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can update empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can view empresas" ON public.empresas;

-- Owner-scoped policies
CREATE POLICY "Users can view own empresas" ON public.empresas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own empresas" ON public.empresas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own empresas" ON public.empresas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own empresas" ON public.empresas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2) Revoke EXECUTE on internal trigger function from API roles
REVOKE EXECUTE ON FUNCTION public.create_default_categories() FROM PUBLIC, anon, authenticated;
