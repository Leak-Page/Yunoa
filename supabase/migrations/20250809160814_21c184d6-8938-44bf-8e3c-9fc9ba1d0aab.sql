-- Enable required extensions for scheduling HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  interval TEXT NOT NULL CHECK (interval IN ('month','lifetime')),
  has_ads BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plans"
  ON public.subscription_plans FOR SELECT USING (true);

CREATE POLICY "Admins can manage plans"
  ON public.subscription_plans FOR ALL
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- Seed default plans
INSERT INTO public.subscription_plans (code, name, price_cents, interval, has_ads)
VALUES
  ('basic_monthly', 'Essentiel (avec pub)', 1200, 'month', true),
  ('premium_monthly', 'Premium (sans pub)', 2300, 'month', false),
  ('lifetime', 'À vie (sans pub)', 5400, 'lifetime', false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  interval = EXCLUDED.interval,
  has_ads = EXCLUDED.has_ads,
  is_active = true,
  updated_at = now();

-- Subscribers table (high-level status)
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_subscription" ON public.subscribers
  FOR SELECT USING (auth.uid() = user_id OR email = auth.email());

CREATE POLICY "update_own_subscription" ON public.subscribers
  FOR UPDATE USING (true);

CREATE POLICY "insert_subscription" ON public.subscribers
  FOR INSERT WITH CHECK (true);

-- Detailed subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card','paypal','paysafecard')),
  status TEXT NOT NULL CHECK (status IN ('active','canceled','expired','incomplete')),
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Billing settings per user
CREATE TABLE IF NOT EXISTS public.billing_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_method TEXT NOT NULL DEFAULT 'card' CHECK (preferred_method IN ('card','paypal','paysafecard')),
  card_auto_renew BOOLEAN NOT NULL DEFAULT true,
  paypal_auto_renew BOOLEAN NOT NULL DEFAULT true,
  paysafecard_auto_renew BOOLEAN NOT NULL DEFAULT false,
  notify_before_days INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own billing settings" ON public.billing_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own billing settings" ON public.billing_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing settings" ON public.billing_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Payments table to track transactions
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe','paypal','paysafecard')),
  provider_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL CHECK (status IN ('pending','paid','failed','canceled')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_payments_user_created ON public.payments(user_id, created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER tr_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_subscribers_updated_at
BEFORE UPDATE ON public.subscribers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_billing_settings_updated_at
BEFORE UPDATE ON public.billing_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();