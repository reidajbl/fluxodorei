
CREATE TABLE public.logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  descricao TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_usuario ON public.logs_auditoria(usuario_id);
CREATE INDEX idx_logs_data ON public.logs_auditoria(created_at DESC);
CREATE INDEX idx_logs_entidade ON public.logs_auditoria(entidade, entidade_id);

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs"
ON public.logs_auditoria FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert their own logs"
ON public.logs_auditoria FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);
