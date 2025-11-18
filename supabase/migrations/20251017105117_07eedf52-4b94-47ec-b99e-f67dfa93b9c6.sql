-- Fix user_video_views security issue
-- Make user_id NOT NULL to prevent bypass attacks
ALTER TABLE user_video_views 
ALTER COLUMN user_id SET NOT NULL;

-- Drop and recreate the INSERT policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Users can create their own views" ON user_video_views;

CREATE POLICY "Users can create their own views"
ON user_video_views
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);