-- Fix security issue: Remove email-based access from subscribers table
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;

CREATE POLICY "select_own_subscription" 
ON public.subscribers 
FOR SELECT 
USING (auth.uid() = user_id);

-- Fix security issue: Enforce user_id validation in user_video_views INSERT policy
DROP POLICY IF EXISTS "Users can create their own views" ON public.user_video_views;

CREATE POLICY "Users can create their own views" 
ON public.user_video_views 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Make user_id NOT NULL to prevent bypass attempts
ALTER TABLE public.user_video_views 
ALTER COLUMN user_id SET NOT NULL;