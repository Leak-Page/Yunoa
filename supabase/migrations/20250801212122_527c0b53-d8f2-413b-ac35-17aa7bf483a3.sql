-- Créer la table pour les codes de vérification email
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  code text NOT NULL,
  used boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Créer les index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email_code ON public.email_verification_codes(email, code);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON public.email_verification_codes(expires_at);

-- Activer RLS
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS (accessible seulement via les fonctions Edge)
CREATE POLICY "Service role can manage verification codes" ON public.email_verification_codes
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');