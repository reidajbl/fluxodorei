
-- Create tipos_recebimento table
CREATE TABLE public.tipos_recebimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  icone TEXT DEFAULT '💳',
  cor TEXT DEFAULT '#3b82f6',
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tipos_recebimento ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own tipos_recebimento" ON public.tipos_recebimento FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tipos_recebimento" ON public.tipos_recebimento FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tipos_recebimento" ON public.tipos_recebimento FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tipos_recebimento" ON public.tipos_recebimento FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add column to lancamentos
ALTER TABLE public.lancamentos ADD COLUMN tipo_recebimento_id UUID REFERENCES public.tipos_recebimento(id);
