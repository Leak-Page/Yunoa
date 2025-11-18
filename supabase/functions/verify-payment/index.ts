import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Payment verification started");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { session_id, payment_id } = await req.json();
    logStep("Request data", { session_id, payment_id });

    if (!session_id && !payment_id) {
      throw new Error("session_id or payment_id required");
    }

    let paymentVerified = false;
    let subscriptionData: any = null;

    if (session_id) {
      // Verify Stripe payment
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      });

      const session = await stripe.checkout.sessions.retrieve(session_id);
      logStep("Stripe session retrieved", { status: session.payment_status, sessionId: session.id });

      if (session.payment_status === 'paid') {
        paymentVerified = true;
        
        // Get payment record
        const { data: payment } = await supabaseService
          .from('payments')
          .select('*, subscription_plans(*)')
          .eq('provider_session_id', session_id)
          .eq('user_id', user.id)
          .single();

        if (payment) {
          // Update payment status
          await supabaseService
            .from('payments')
            .update({ status: 'paid' })
            .eq('id', payment.id);

          // Create/activate subscription
          const plan = payment.subscription_plans;
          const now = new Date();
          
          subscriptionData = {
            user_id: user.id,
            plan_id: plan.id,
            payment_method: session.metadata?.payment_method || 'card',
            status: 'active',
            auto_renew: payment.provider !== 'paysafecard'
          };

          // Calculate subscription period
          if (plan.interval === 'month') {
            const endDate = new Date(now.setMonth(now.getMonth() + 1));
            subscriptionData.current_period_start = new Date().toISOString();
            subscriptionData.current_period_end = endDate.toISOString();
          } else if (plan.interval === 'lifetime') {
            subscriptionData.current_period_start = new Date().toISOString();
            // No end date for lifetime
          }

          // Create subscription
          const { error: subError } = await supabaseService
            .from('subscriptions')
            .upsert(subscriptionData);

          if (subError) {
            logStep("Error creating subscription", { error: subError.message });
            throw new Error("Failed to create subscription");
          }

          // Update subscribers table
          await supabaseService
            .from('subscribers')
            .upsert({
              user_id: user.id,
              email: user.email,
              stripe_customer_id: session.customer as string,
              subscribed: true,
              subscription_tier: plan.name,
              subscription_end: subscriptionData.current_period_end || null,
              updated_at: new Date().toISOString()
            });

          // Create success notification
          await supabaseService
            .from('notifications')
            .insert({
              user_id: user.id,
              title: '✅ Abonnement activé',
              message: `Votre abonnement ${plan.name} a été activé avec succès. Profitez de tous les contenus premium !`,
              is_read: false
            });

          logStep("Subscription activated successfully", { userId: user.id, planName: plan.name });
        }
      }
    } else if (payment_id) {
      // Verify Paysafecard payment (manual verification for now)
      const { data: payment } = await supabaseService
        .from('payments')
        .select('*, subscription_plans(*)')
        .eq('provider_session_id', payment_id)
        .eq('user_id', user.id)
        .single();

      if (payment && payment.status === 'paid') {
        paymentVerified = true;
        
        const plan = payment.subscription_plans;
        subscriptionData = {
          user_id: user.id,
          plan_id: plan.id,
          payment_method: 'paysafecard',
          status: 'active',
          auto_renew: false
        };

        // For Paysafecard, typically 1 month access
        if (plan.interval === 'month') {
          const now = new Date();
          const endDate = new Date(now.setMonth(now.getMonth() + 1));
          subscriptionData.current_period_start = new Date().toISOString();
          subscriptionData.current_period_end = endDate.toISOString();
        }

        // Create subscription
        await supabaseService
          .from('subscriptions')
          .upsert(subscriptionData);

        // Update subscribers table
        await supabaseService
          .from('subscribers')
          .upsert({
            user_id: user.id,
            email: user.email,
            subscribed: true,
            subscription_tier: plan.name,
            subscription_end: subscriptionData.current_period_end || null,
            updated_at: new Date().toISOString()
          });

        logStep("Paysafecard subscription activated", { userId: user.id, planName: plan.name });
      }
    }

    return new Response(JSON.stringify({
      payment_verified: paymentVerified,
      subscription_active: paymentVerified,
      subscription_data: subscriptionData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      payment_verified: false,
      subscription_active: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});