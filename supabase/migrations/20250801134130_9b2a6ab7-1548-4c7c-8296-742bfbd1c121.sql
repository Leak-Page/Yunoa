-- Configure Auth Webhook for custom email sending
-- Note: This needs to be done manually in the Supabase dashboard
-- as webhooks cannot be configured via SQL migrations

-- Generate a webhook secret for security
INSERT INTO vault.secrets (name, secret) 
VALUES ('SEND_EMAIL_HOOK_SECRET', 'yunoa_webhook_secret_' || gen_random_uuid()::text)
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

-- Create a function to get the webhook URL
CREATE OR REPLACE FUNCTION get_webhook_url()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'https://efeommwlobsenrvqedcj.supabase.co/functions/v1/send-email';
END;
$$;