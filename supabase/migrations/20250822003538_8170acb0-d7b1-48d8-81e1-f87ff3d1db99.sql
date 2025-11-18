-- Update the videos table UPDATE policy to allow admins to update any video
DROP POLICY IF EXISTS "Users can update their own videos" ON public.videos;

CREATE POLICY "Users can update their own videos or admins can update any video" 
ON public.videos 
FOR UPDATE 
USING ((auth.uid() = created_by) OR (get_current_user_role() = 'admin'::text))
WITH CHECK ((auth.uid() = created_by) OR (get_current_user_role() = 'admin'::text));