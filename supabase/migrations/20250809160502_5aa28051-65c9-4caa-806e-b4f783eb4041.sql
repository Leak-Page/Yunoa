-- Enable required extensions for scheduling HTTP calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Plans table
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_cents integer not null,
  currency text not null default 'eur',
  interval text not null check (interval in ('month','lifetime')),
  has_ads boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;
create policy if not exists "Anyone can view plans"
  on public.subscription_plans for select using (true);
create policy if not exists "Admins can manage plans"
  on public.subscription_plans for all
  using (get_current_user_role() = 'admin')
  with check (get_current_user_role() = 'admin');

-- Seed default plans
insert into public.subscription_plans (code, name, price_cents, interval, has_ads)
values
  ('basic_monthly', 'Essentiel (avec pub)', 1200, 'month', true),
  ('premium_monthly', 'Premium (sans pub)', 2300, 'month', false),
  ('lifetime', 'À vie (sans pub)', 5400, 'lifetime', false)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  interval = excluded.interval,
  has_ads = excluded.has_ads,
  is_active = true,
  updated_at = now();

-- Subscribers table (high-level status)
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null unique,
  stripe_customer_id text,
  subscribed boolean not null default false,
  subscription_tier text,
  subscription_end timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;
create policy if not exists "select_own_subscription" on public.subscribers
  for select using (auth.uid() = user_id or email = auth.email());
create policy if not exists "update_own_subscription" on public.subscribers
  for update using (true);
create policy if not exists "insert_subscription" on public.subscribers
  for insert with check (true);

-- Detailed subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  payment_method text not null check (payment_method in ('card','paypal','paysafecard')),
  status text not null check (status in ('active','canceled','expired','incomplete')),
  auto_renew boolean not null default true,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy if not exists "Users can view their own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);
-- writes handled by edge functions (service role), so no user insert/update policies

-- Billing settings per user
create table if not exists public.billing_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_method text not null default 'card' check (preferred_method in ('card','paypal','paysafecard')),
  card_auto_renew boolean not null default true,
  paypal_auto_renew boolean not null default true,
  paysafecard_auto_renew boolean not null default false,
  notify_before_days integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_settings enable row level security;
create policy if not exists "Users can view their own billing settings" on public.billing_settings
  for select using (auth.uid() = user_id);
create policy if not exists "Users can upsert their own billing settings" on public.billing_settings
  for insert with check (auth.uid() = user_id);
create policy if not exists "Users can update their own billing settings" on public.billing_settings
  for update using (auth.uid() = user_id);

-- Payments table to track transactions
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  provider text not null check (provider in ('stripe','paypal','paysafecard')),
  provider_session_id text,
  amount_cents integer not null,
  currency text not null default 'eur',
  status text not null check (status in ('pending','paid','failed','canceled')),
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;
create policy if not exists "Users can view their own payments" on public.payments
  for select using (auth.uid() = user_id);
-- writes handled by edge functions (service role)

-- Indexes
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_period_end on public.subscriptions(current_period_end);
create index if not exists idx_payments_user_created on public.payments(user_id, created_at desc);

-- Triggers for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tr_subscription_plans_updated_at
before update on public.subscription_plans
for each row execute function public.update_updated_at_column();

create trigger tr_subscribers_updated_at
before update on public.subscribers
for each row execute function public.update_updated_at_column();

create trigger tr_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.update_updated_at_column();

create trigger tr_billing_settings_updated_at
before update on public.billing_settings
for each row execute function public.update_updated_at_column();

create trigger tr_payments_updated_at
before update on public.payments
for each row execute function public.update_updated_at_column();

-- Schedule daily reminders (09:00 UTC) to call edge function 'send-renewal-reminders'
DO $$
BEGIN
  PERFORM cron.schedule(
    'send-renewal-reminders-daily',
    '0 9 * * *',
    $$select net.http_post(
        url:='https://efeommwlobsenrvqedcj.supabase.co/functions/v1/send-renewal-reminders',
        headers:='{"Content-Type":"application/json"}'::jsonb,
        body:='{}'::jsonb
    )$$
  );
EXCEPTION WHEN OTHERS THEN
  -- ignore if already scheduled
  NULL;
END$$;