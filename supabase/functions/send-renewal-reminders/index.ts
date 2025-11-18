import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RENEWAL-REMINDERS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Cron job started - checking for upcoming renewals");

    // Initialize Supabase with service role
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const now = new Date();
    
    // Get all active subscriptions that need renewal reminders
    const { data: subscriptions, error: subError } = await supabaseService
      .from('subscriptions')
      .select(`
        *,
        profiles:user_id (username, id),
        subscription_plans:plan_id (name, price_cents, currency, interval),
        billing_settings:user_id (notify_before_days, preferred_method, card_auto_renew, paypal_auto_renew, paysafecard_auto_renew)
      `)
      .eq('status', 'active')
      .not('current_period_end', 'is', null);

    if (subError) {
      throw new Error(`Error fetching subscriptions: ${subError.message}`);
    }

    logStep("Found subscriptions", { count: subscriptions?.length || 0 });

    let remindersSent = 0;

    for (const subscription of subscriptions || []) {
      try {
        const endDate = new Date(subscription.current_period_end);
        const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const notifyDays = subscription.billing_settings?.notify_before_days || 2;

        logStep("Checking subscription", {
          userId: subscription.user_id,
          daysUntilExpiry,
          notifyDays,
          paymentMethod: subscription.payment_method
        });

        // Check if we should send a reminder
        if (daysUntilExpiry <= notifyDays && daysUntilExpiry > 0) {
          const autoRenewEnabled = subscription.billing_settings?.[`${subscription.payment_method}_auto_renew`] ?? true;
          
          // Determine notification type
          let notificationType: string;
          let notificationTitle: string;
          let notificationMessage: string;

          if (subscription.payment_method === 'paysafecard' || !autoRenewEnabled) {
            // Manual renewal required
            notificationType = 'manual_renewal_reminder';
            notificationTitle = '⏰ Renouvellement requis';
            notificationMessage = `Votre abonnement ${subscription.subscription_plans.name} expire dans ${daysUntilExpiry} jour(s). Veuillez le renouveler manuellement pour continuer à profiter de nos services.`;
          } else {
            // Auto-renewal reminder
            notificationType = 'auto_renewal_reminder';
            notificationTitle = '🔄 Renouvellement automatique';
            notificationMessage = `Votre abonnement ${subscription.subscription_plans.name} sera renouvelé automatiquement dans ${daysUntilExpiry} jour(s) via ${subscription.payment_method}. Montant: ${(subscription.subscription_plans.price_cents / 100).toFixed(2)}€.`;
          }

          // Check if we already sent this reminder recently
          const { data: existingNotif } = await supabaseService
            .from('notifications')
            .select('id')
            .eq('user_id', subscription.user_id)
            .eq('title', notificationTitle)
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
            .maybeSingle();

          if (!existingNotif) {
            // Create notification
            const { error: notifError } = await supabaseService
              .from('notifications')
              .insert({
                user_id: subscription.user_id,
                title: notificationTitle,
                message: notificationMessage,
                is_read: false
              });

            if (notifError) {
              logStep("Error creating notification", { error: notifError.message });
            } else {
              remindersSent++;
              logStep("Reminder sent", {
                userId: subscription.user_id,
                type: notificationType,
                daysUntilExpiry
              });
            }
          } else {
            logStep("Reminder already sent recently", { userId: subscription.user_id });
          }
        }
      } catch (error) {
        logStep("Error processing subscription", {
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logStep("Cron job completed", { remindersSent });

    return new Response(JSON.stringify({
      success: true,
      remindersSent,
      subscriptionsChecked: subscriptions?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});