-- Fix critical security vulnerability: Restrict episode management to video owners and admins
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage episodes" ON episodes;

-- Create secure policies for episode management
CREATE POLICY "Video creators can create episodes for their videos"
ON episodes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM videos 
    WHERE videos.id = series_id 
    AND videos.created_by = auth.uid()
  )
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Video creators can update episodes for their videos"
ON episodes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM videos 
    WHERE videos.id = series_id 
    AND videos.created_by = auth.uid()
  )
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "Video creators can delete episodes for their videos"
ON episodes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM videos 
    WHERE videos.id = series_id 
    AND videos.created_by = auth.uid()
  )
  OR get_current_user_role() = 'admin'
);