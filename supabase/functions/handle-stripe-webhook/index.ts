import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      throw new Error("Missing stripe signature or webhook secret");
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err });
      return new Response("Webhook signature verification failed", { status: 400 });
    }

    logStep("Event type", { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });

        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const paymentMethod = session.metadata?.payment_method || 'card';

        if (!userId || !planId) {
          logStep("Missing metadata", { userId, planId });
          break;
        }

        // Get plan details
        const { data: plan } = await supabaseService
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (!plan) {
          logStep("Plan not found", { planId });
          break;
        }

        // Update payment status
        await supabaseService
          .from('payments')
          .update({ status: 'paid' })
          .eq('provider_session_id', session.id);

        // Create or update subscription
        const subscriptionData = {
          user_id: userId,
          plan_id: planId,
          payment_method: paymentMethod,
          status: 'active',
          auto_renew: paymentMethod !== 'paysafecard'
        };

        if (plan.interval === 'month') {
          const now = new Date();
          const endDate = new Date(now.setMonth(now.getMonth() + 1));
          subscriptionData.current_period_start = new Date().toISOString();
          subscriptionData.current_period_end = endDate.toISOString();
        } else if (plan.interval === 'lifetime') {
          subscriptionData.current_period_start = new Date().toISOString();
          // Lifetime subscriptions don't have an end date
        }

        const { error: subError } = await supabaseService
          .from('subscriptions')
          .upsert(subscriptionData);

        if (subError) {
          logStep("Error creating subscription", { error: subError.message });
          break;
        }

        // Update subscribers table
        await supabaseService
          .from('subscribers')
          .upsert({
            user_id: userId,
            email: session.customer_details?.email || '',
            stripe_customer_id: session.customer as string,
            subscribed: true,
            subscription_tier: plan.name,
            subscription_end: subscriptionData.current_period_end || null,
            updated_at: new Date().toISOString()
          });

        logStep("Subscription created successfully", { userId, planId });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = stripeSubscription.customer as string;
          
          // Find user by stripe customer ID
          const { data: subscriber } = await supabaseService
            .from('subscribers')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();

          if (subscriber) {
            // Update subscription period
            await supabaseService
              .from('subscriptions')
              .update({
                current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
                status: 'active'
              })
              .eq('user_id', subscriber.user_id);

            logStep("Subscription renewed", { userId: subscriber.user_id });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = stripeSubscription.customer as string;
          
          const { data: subscriber } = await supabaseService
            .from('subscribers')
            .select('user_id, profiles(username)')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();

          if (subscriber) {
            // Create notification for failed payment
            await supabaseService
              .from('notifications')
              .insert({
                user_id: subscriber.user_id,
                title: '❌ Échec du paiement',
                message: 'Le paiement de votre abonnement a échoué. Veuillez mettre à jour vos informations de paiement pour éviter l\'interruption du service.',
                is_read: false
              });

            logStep("Payment failed notification sent", { userId: subscriber.user_id });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const { data: subscriber } = await supabaseService
          .from('subscribers')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (subscriber) {
          // Mark subscription as canceled
          await supabaseService
            .from('subscriptions')
            .update({ status: 'canceled' })
            .eq('user_id', subscriber.user_id);

          // Update subscribers table
          await supabaseService
            .from('subscribers')
            .update({
              subscribed: false,
              subscription_tier: null,
              subscription_end: null
            })
            .eq('user_id', subscriber.user_id);

          logStep("Subscription canceled", { userId: subscriber.user_id });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});