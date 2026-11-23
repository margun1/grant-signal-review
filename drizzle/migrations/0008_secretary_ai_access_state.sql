CREATE TABLE public.secretary_ai_access (scope text PRIMARY KEY, status integer NOT NULL, reason text NOT NULL, message text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.secretary_ai_access TO authenticated;
GRANT ALL ON public.secretary_ai_access TO service_role;
ALTER TABLE public.secretary_ai_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read ai access" ON public.secretary_ai_access FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));