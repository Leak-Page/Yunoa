-- Fix overly permissive RLS policies on subscribers table
-- These policies were allowing unrestricted access which could expose customer emails and Stripe data

-- Drop the existing overly permissive policies
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create secure replacement policies that properly restrict access

-- Only allow users to update their own subscription records
CREATE POLICY "update_own_subscription" ON public.subscribers
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Only allow users to insert subscription records for themselves
CREATE POLICY "insert_subscription" ON public.subscribers
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Also ensure the user_id column cannot be modified to prevent privilege escalation
-- Add a check to prevent users from changing the user_id after insert
CREATE POLICY "prevent_user_id_modification" ON public.subscribers
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND user_id = (SELECT user_id FROM public.subscribers WHERE id = subscribers.id));