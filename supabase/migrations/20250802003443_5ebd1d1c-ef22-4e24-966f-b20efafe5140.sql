-- Vérifier et créer le profil pour l'utilisateur existant
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Récupérer l'utilisateur depuis auth.users avec l'email donné
    SELECT id, email, raw_user_meta_data 
    INTO user_record
    FROM auth.users 
    WHERE email = 'graditoss82@gmail.com'
    LIMIT 1;
    
    IF user_record.id IS NOT NULL THEN
        -- Insérer ou mettre à jour le profil
        INSERT INTO public.profiles (id, username, role)
        VALUES (
            user_record.id,
            COALESCE(user_record.raw_user_meta_data ->> 'username', 'fragment5685'),
            'admin'
        )
        ON CONFLICT (id) 
        DO UPDATE SET 
            username = COALESCE(user_record.raw_user_meta_data ->> 'username', 'fragment5685'),
            role = 'admin',
            updated_at = now();
        
        RAISE NOTICE 'Profile créé/mis à jour pour utilisateur %', user_record.id;
    ELSE
        RAISE NOTICE 'Aucun utilisateur trouvé avec cet email';
    END IF;
END $$;

-- Supprimer les anciennes politiques et en créer de nouvelles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Créer une politique permettant aux utilisateurs de voir leur propre profil
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Créer une politique permettant aux admins de voir tous les profils
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role = 'admin'
    )
);