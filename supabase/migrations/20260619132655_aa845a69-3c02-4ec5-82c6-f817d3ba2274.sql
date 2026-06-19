
-- Restrict RLS policies to authenticated users only on financial tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['categorias','contas','despesas_fixas','lancamentos']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update their own %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete their own %1$s" ON public.%1$s', t);

    EXECUTE format('CREATE POLICY "Users can view their own %1$s" ON public.%1$s FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Users can insert their own %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Users can update their own %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Users can delete their own %1$s" ON public.%1$s FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;

-- Revoke any anon privileges; ensure authenticated has needed grants
REVOKE ALL ON public.categorias, public.contas, public.despesas_fixas, public.lancamentos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias, public.contas, public.despesas_fixas, public.lancamentos TO authenticated;
GRANT ALL ON public.categorias, public.contas, public.despesas_fixas, public.lancamentos TO service_role;
