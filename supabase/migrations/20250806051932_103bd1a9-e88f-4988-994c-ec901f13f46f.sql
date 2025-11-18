-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_users_with_emails();
DROP FUNCTION IF EXISTS public.get_users_with_emails_simple();

-- Recreate functions with correct column names
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
    COALESCE(au.email, 'Email non disponible') as email
  FROM profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_users_with_emails_simple()
 RETURNS TABLE(id uuid, username text, avatar text, role text, created_at timestamp with time zone, updated_at timestamp with time zone, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar,
    p.role,
    p.created_at,
    p.updated_at,
    COALESCE(au.email, 'Email non disponible') as email
  FROM profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY p.created_at DESC;
END;
$function$;