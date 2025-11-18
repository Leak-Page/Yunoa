-- Corriger les fonctions avec search_path pour résoudre les warnings de sécurité
CREATE OR REPLACE FUNCTION public.is_user_banned(user_uuid uuid)
 RETURNS TABLE(is_banned boolean, ban_reason text, banned_by_username text, banned_at timestamp with time zone, unban_at timestamp with time zone, is_permanent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN ub.id IS NOT NULL THEN true ELSE false END as is_banned,
    ub.reason as ban_reason,
    p.username as banned_by_username,
    ub.banned_at,
    ub.unban_at,
    ub.is_permanent
  FROM user_bans ub
  LEFT JOIN profiles p ON ub.banned_by = p.id
  WHERE ub.user_id = user_uuid 
    AND ub.is_active = true
    AND (ub.is_permanent = true OR ub.unban_at > now())
  ORDER BY ub.created_at DESC
  LIMIT 1;
END;
$function$;

-- Corriger la fonction get_users_with_emails
CREATE OR REPLACE FUNCTION public.get_users_with_emails()
 RETURNS TABLE(id uuid, username text, avatar text, role text, created_at timestamp with time zone, updated_at timestamp with time zone, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, auth
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