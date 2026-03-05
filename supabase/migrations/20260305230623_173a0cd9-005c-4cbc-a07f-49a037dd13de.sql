
-- Create empresas table
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create contas table
CREATE TABLE public.contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('dinheiro', 'banco', 'carteira', 'outro')),
  saldo_inicial DECIMAL(12,2) DEFAULT 0,
  cor TEXT DEFAULT '#3b82f6',
  icone TEXT DEFAULT '💰',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create categorias table
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#6b7280',
  tipo TEXT CHECK (tipo IN ('receita', 'despesa', 'ambos')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create lancamentos table
CREATE TABLE public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  categoria_id UUID REFERENCES public.categorias(id),
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  status TEXT DEFAULT 'a_vencer',
  observacoes TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create despesas_fixas table
CREATE TABLE public.despesas_fixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  categoria_id UUID REFERENCES public.categorias(id),
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  ativo BOOLEAN DEFAULT TRUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas_fixas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contas
CREATE POLICY "Users can view their own contas" ON public.contas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own contas" ON public.contas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contas" ON public.contas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contas" ON public.contas FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for categorias
CREATE POLICY "Users can view their own categorias" ON public.categorias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own categorias" ON public.categorias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categorias" ON public.categorias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categorias" ON public.categorias FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for lancamentos
CREATE POLICY "Users can view their own lancamentos" ON public.lancamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own lancamentos" ON public.lancamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own lancamentos" ON public.lancamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own lancamentos" ON public.lancamentos FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for despesas_fixas
CREATE POLICY "Users can view their own despesas_fixas" ON public.despesas_fixas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own despesas_fixas" ON public.despesas_fixas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own despesas_fixas" ON public.despesas_fixas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own despesas_fixas" ON public.despesas_fixas FOR DELETE USING (auth.uid() = user_id);

-- Function to create default categories for new users
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.categorias (nome, cor, tipo, user_id) VALUES
    ('💵 PIX', '#10b981', 'ambos', NEW.id),
    ('💳 Crédito', '#3b82f6', 'receita', NEW.id),
    ('💳 Débito', '#8b5cf6', 'receita', NEW.id),
    ('💰 Dinheiro', '#f59e0b', 'receita', NEW.id),
    ('💼 Salário', '#ec4899', 'receita', NEW.id),
    ('🏠 Aluguel', '#ef4444', 'despesa', NEW.id),
    ('🍔 Alimentação', '#f97316', 'despesa', NEW.id),
    ('📶 Internet', '#06b6d4', 'despesa', NEW.id),
    ('💧 Água', '#0ea5e9', 'despesa', NEW.id),
    ('⚡ Luz', '#2563eb', 'despesa', NEW.id),
    ('📱 Telefone', '#7c3aed', 'despesa', NEW.id),
    ('🚗 Transporte', '#db2777', 'despesa', NEW.id),
    ('🎮 Lazer', '#c2410c', 'despesa', NEW.id),
    ('🏥 Saúde', '#059669', 'despesa', NEW.id),
    ('📚 Educação', '#d97706', 'despesa', NEW.id),
    ('🛒 Compras', '#4b5563', 'despesa', NEW.id),
    ('❓ Outros', '#6b7280', 'ambos', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create default categories on user signup
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();
