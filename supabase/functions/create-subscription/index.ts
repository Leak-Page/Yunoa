import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  plan_id: string;
  plan_code: string;
  payment_method: 'card' | 'paypal' | 'paysafecard';
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase with service role for secure operations
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

    // Parse request body
    const body: CreateSubscriptionRequest = await req.json();
    const { plan_id, plan_code, payment_method } = body;
    logStep("Request parsed", { plan_id, plan_code, payment_method });

    // Validate plan exists
    const { data: plan, error: planError } = await supabaseService
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      throw new Error("Plan not found or inactive");
    }
    logStep("Plan validated", { planCode: plan.code, price: plan.price_cents });

    // Check if user already has an active subscription
    const { data: existingSub } = await supabaseService
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      throw new Error("User already has an active subscription");
    }

    let paymentUrl: string;

    if (payment_method === 'card' || payment_method === 'paypal') {
      // Use Stripe for card and PayPal payments
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      });

      // Check/create Stripe customer
      let customerId: string;
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id }
        });
        customerId = customer.id;
      }
      logStep("Stripe customer ready", { customerId });

      // Create checkout session
      const sessionParams: any = {
        customer: customerId,
        line_items: [{
          price_data: {
            currency: plan.currency,
            product_data: { 
              name: plan.name,
              description: `Abonnement Yunoa - ${plan.name}`
            },
            unit_amount: plan.price_cents,
          },
          quantity: 1,
        }],
        success_url: `${req.headers.get("origin") || "https://yunoa.xyz"}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin") || "https://yunoa.xyz"}/subscription/cancel`,
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          payment_method: payment_method
        }
      };

      // Configure session based on plan type and payment method
      if (plan.interval === 'lifetime') {
        sessionParams.mode = 'payment';
      } else {
        sessionParams.mode = 'subscription';
        sessionParams.line_items[0].price_data.recurring = {
          interval: plan.interval
        };
      }

      // Add PayPal if specified
      if (payment_method === 'paypal') {
        sessionParams.payment_method_types = ['card', 'paypal'];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      paymentUrl = session.url!;
      logStep("Stripe session created", { sessionId: session.id, url: session.url });

      // Store payment record
      await supabaseService.from('payments').insert({
        user_id: user.id,
        plan_id: plan_id,
        provider: 'stripe',
        provider_session_id: session.id,
        amount_cents: plan.price_cents,
        currency: plan.currency,
        status: 'pending',
        is_recurring: plan.interval !== 'lifetime'
      });

    } else if (payment_method === 'paysafecard') {
      // For Paysafecard, create a custom payment page
      const paymentId = crypto.randomUUID();
      
      // Store payment record for Paysafecard
      await supabaseService.from('payments').insert({
        user_id: user.id,
        plan_id: plan_id,
        provider: 'paysafecard',
        provider_session_id: paymentId,
        amount_cents: plan.price_cents,
        currency: plan.currency,
        status: 'pending',
        is_recurring: false // Paysafecard is always manual
      });

      // Create a custom payment URL for Paysafecard
      paymentUrl = `${req.headers.get("origin") || "https://yunoa.xyz"}/payment/paysafecard?payment_id=${paymentId}&amount=${plan.price_cents}&currency=${plan.currency}&plan=${encodeURIComponent(plan.name)}`;
      logStep("Paysafecard payment created", { paymentId, paymentUrl });
    } else {
      throw new Error("Unsupported payment method");
    }

    // Update/create billing settings
    await supabaseService.from('billing_settings').upsert({
      user_id: user.id,
      preferred_method: payment_method,
      [`${payment_method}_auto_renew`]: payment_method !== 'paysafecard',
      notify_before_days: 2
    });
    logStep("Billing settings updated");

    return new Response(JSON.stringify({ 
      payment_url: paymentUrl,
      plan_name: plan.name 
    }), {
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