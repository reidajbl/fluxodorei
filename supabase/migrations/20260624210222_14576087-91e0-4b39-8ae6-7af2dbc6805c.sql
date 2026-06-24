
CREATE TABLE public.preferencias_usuario (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_tipo text NOT NULL DEFAULT 'preset' CHECK (banner_tipo IN ('preset','imagem')),
  banner_valor text NOT NULL DEFAULT 'preset-1',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias_usuario TO authenticated;
GRANT ALL ON public.preferencias_usuario TO service_role;

ALTER TABLE public.preferencias_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own pref"
  ON public.preferencias_usuario FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user inserts own pref"
  ON public.preferencias_usuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user updates own pref"
  ON public.preferencias_usuario FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user deletes own pref"
  ON public.preferencias_usuario FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_preferencias_usuario()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_touch_preferencias_usuario
BEFORE UPDATE ON public.preferencias_usuario
FOR EACH ROW EXECUTE FUNCTION public.touch_preferencias_usuario();

-- Storage policies for 'banners' bucket (bucket created via tool separately)
CREATE POLICY "banners public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'banners');

CREATE POLICY "banners user insert own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "banners user update own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "banners user delete own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
