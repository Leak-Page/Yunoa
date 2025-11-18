-- Créer une fonction sécurisée pour obtenir le rôle de l'utilisateur actuel
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Supprimer l'ancienne politique admin problématique
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recréer la politique admin avec la fonction sécurisée
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.get_current_user_role() = 'admin');