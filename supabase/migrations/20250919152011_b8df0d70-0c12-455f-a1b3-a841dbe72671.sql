-- Corriger la fonction get_users_with_emails pour résoudre l'erreur de type
DROP FUNCTION IF EXISTS public.get_users_with_emails();

CREATE OR REPLACE FUNCTION public.get_users_with_emails()
 RETURNS TABLE(id uuid, username text, avatar text, role text, created_at timestamp with time zone, updated_at timestamp with time zone, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Vérifier que l'utilisateur actuel est un admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé. Seuls les administrateurs peuvent accéder à cette fonction.';
  END IF;

  -- Retourner les utilisateurs avec leurs emails
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar,
    p.role,
    p.created_at,
    p.updated_at,
    COALESCE(au.email::text, 'Email non disponible'::text) as email
  FROM profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY p.created_at DESC;
END;
$function$;

-- Créer la table pour les bans d'utilisateurs
CREATE TABLE public.user_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unban_at TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Créer la table pour les vues par utilisateur
CREATE TABLE public.user_video_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Créer la table pour suspendre/reprendre les abonnements
CREATE TABLE public.subscription_suspensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  suspended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  suspended_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  days_remaining INTEGER,
  original_end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS sur les nouvelles tables
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_suspensions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour user_bans
CREATE POLICY "Admins can manage bans" ON public.user_bans
  FOR ALL USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view their own ban status" ON public.user_bans
  FOR SELECT USING (auth.uid() = user_id);

-- Politiques RLS pour user_video_views
CREATE POLICY "Users can view their own views" ON public.user_video_views
  FOR SELECT USING (auth.uid() = user_id OR get_current_user_role() = 'admin');

CREATE POLICY "Users can create their own views" ON public.user_video_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politiques RLS pour subscription_suspensions
CREATE POLICY "Admins can manage suspensions" ON public.subscription_suspensions
  FOR ALL USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view their own suspensions" ON public.subscription_suspensions
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger pour update automatique des timestamps
CREATE TRIGGER update_user_bans_updated_at
  BEFORE UPDATE ON public.user_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_suspensions_updated_at
  BEFORE UPDATE ON public.subscription_suspensions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();