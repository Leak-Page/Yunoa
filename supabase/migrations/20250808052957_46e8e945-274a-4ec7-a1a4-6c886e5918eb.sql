-- Add updated_at column to notifications and admin RLS policies + trigger for updated_at

-- 1) Add updated_at column if not exists
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2) Create or replace a reusable function to update updated_at on row update
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Create trigger to auto-update updated_at on notifications updates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_notifications_updated_at'
  ) THEN
    CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 4) RLS policies to allow admins to manage notifications system-wide
-- Allow admins to SELECT all notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Admins can view all notifications'
  ) THEN
    CREATE POLICY "Admins can view all notifications"
    ON public.notifications
    FOR SELECT
    USING (public.get_current_user_role() = 'admin');
  END IF;
END$$;

-- Allow admins to UPDATE any notification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Admins can update any notifications'
  ) THEN
    CREATE POLICY "Admins can update any notifications"
    ON public.notifications
    FOR UPDATE
    USING (public.get_current_user_role() = 'admin');
  END IF;
END$$;

-- Allow admins to DELETE notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Admins can delete notifications'
  ) THEN
    CREATE POLICY "Admins can delete notifications"
    ON public.notifications
    FOR DELETE
    USING (public.get_current_user_role() = 'admin');
  END IF;
END$$;
