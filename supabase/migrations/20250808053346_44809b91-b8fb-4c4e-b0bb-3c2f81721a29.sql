-- Add foreign key relationship between notifications and profiles tables

-- First, ensure all existing notification user_ids reference valid profiles
-- (Clean up any orphaned notifications)
DELETE FROM public.notifications 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- Now add the foreign key constraint
ALTER TABLE public.notifications 
ADD CONSTRAINT fk_notifications_user_id 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;