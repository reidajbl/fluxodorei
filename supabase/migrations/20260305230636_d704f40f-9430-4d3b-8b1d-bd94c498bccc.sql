
-- Add RLS policy for empresas (allow authenticated users to manage)
CREATE POLICY "Authenticated users can view empresas" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert empresas" ON public.empresas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update empresas" ON public.empresas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete empresas" ON public.empresas FOR DELETE TO authenticated USING (true);
