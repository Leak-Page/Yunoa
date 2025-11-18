-- Ajouter le champ role à la table profiles
ALTER TABLE public.profiles 
ADD COLUMN role TEXT NOT NULL DEFAULT 'membre';

-- Mettre à jour la fonction handle_new_user pour inclure le rôle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'membre'
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log l'erreur mais ne bloque pas l'inscription
    RAISE WARNING 'Erreur lors de la création du profil: %', SQLERRM;
    RETURN NEW;
END;
$$;