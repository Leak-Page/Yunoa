import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GiveSubscriptionRequest {
  user_id: string;
  plan_code: string;
  duration_months?: number;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GIVE-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Authenticate admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const admin = userData.user;
    if (!admin?.email) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: adminProfile } = await supabaseService
      .from('profiles')
      .select('role, username')
      .eq('id', admin.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      throw new Error("Access denied. Admin role required.");
    }
    logStep("Admin authenticated", { adminId: admin.id, username: adminProfile.username });

    // Parse request body
    const body: GiveSubscriptionRequest = await req.json();
    let { user_id, plan_code, duration_months = 1 } = body;
    
    // Map plan codes if needed for backwards compatibility
    const planCodeMapping: Record<string, string> = {
      'essentiel': 'basic_monthly',
      'premium': 'premium_monthly',
      'lifetime': 'lifetime'
    };
    
    if (planCodeMapping[plan_code]) {
      logStep("Mapped plan_code alias", { from: plan_code, to: planCodeMapping[plan_code] });
      plan_code = planCodeMapping[plan_code];
    }
    
    logStep("Request parsed", { user_id, plan_code, duration_months });

    // Get target user info
    const { data: targetUser, error: targetUserError } = await supabaseService.auth.admin.getUserById(user_id);
    if (targetUserError || !targetUser) {
      throw new Error("Target user not found");
    }

    const { data: targetProfile } = await supabaseService
      .from('profiles')
      .select('username')
      .eq('id', user_id)
      .single();

    logStep("Target user found", { userId: user_id, email: targetUser.user.email, username: targetProfile?.username });

    // Get plan info
    const { data: plan, error: planError } = await supabaseService
      .from('subscription_plans')
      .select('*')
      .eq('code', plan_code)
      .eq('is_active', true)
      .single();

    if (planError) {
      logStep("Plan query error", { error: planError.message, code: plan_code });
      throw new Error(`Database error when fetching plan: ${planError.message}`);
    }
    
    if (!plan) {
      logStep("Plan not found", { requested_code: plan_code, available_plans: "checking..." });
      
      // Log available plans for debugging
      const { data: availablePlans } = await supabaseService
        .from('subscription_plans')
        .select('code, name, is_active')
        .eq('is_active', true);
      
      logStep("Available plans", { plans: availablePlans });
      throw new Error(`Plan with code '${plan_code}' not found or inactive. Available plans: ${availablePlans?.map(p => p.code).join(', ')}`);
    }
    logStep("Plan found", { planId: plan.id, planName: plan.name });

    // Calculate subscription end date
    let subscriptionEnd: string;
    if (plan_code === 'lifetime') {
      // Lifetime subscription - set to 100 years from now
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 100);
      subscriptionEnd = endDate.toISOString();
    } else {
      // Regular subscription
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + duration_months);
      subscriptionEnd = endDate.toISOString();
    }

    // Check for existing active subscription
    const { data: existingSub } = await supabaseService
      .from('subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      // Update existing subscription
      await supabaseService
        .from('subscriptions')
        .update({
          plan_id: plan.id,
          current_period_end: subscriptionEnd,
          payment_method: 'admin_gift',
          auto_renew: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSub.id);
      logStep("Updated existing subscription");
    } else {
      // Create new subscription
      await supabaseService
        .from('subscriptions')
        .insert({
          user_id: user_id,
          plan_id: plan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: subscriptionEnd,
          payment_method: 'admin_gift',
          auto_renew: false
        });
      logStep("Created new subscription");
    }

    // Update subscribers table
    const { error: subscribersError } = await supabaseService
      .from('subscribers')
      .upsert({
        user_id: user_id,
        email: targetUser.user.email,
        subscribed: true,
        subscription_tier: plan.name,
        subscription_end: subscriptionEnd,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });
    
    if (subscribersError) {
      console.error('Error updating subscribers table:', subscribersError);
      throw new Error(`Failed to update subscribers table: ${subscribersError.message}`);
    }
    logStep("Updated subscribers table successfully");

    // Send Discord webhook
    const webhookUrl = "https://discord.com/api/webhooks/1398578324636176466/Bk_mv7IKNbcMx96OpCc_SpTAPaKlhZelG2orwec-A1oOtQE1wcCDawXkWa2_WUATme7N";
    
    const discordMessage = {
      content: `${adminProfile.username} a offert un abonnement ${plan.name} à @${targetProfile?.username || targetUser.user.email}`
    };

    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(discordMessage)
      });

      if (!webhookResponse.ok) {
        console.error('Discord webhook failed:', await webhookResponse.text());
      } else {
        logStep("Discord webhook sent successfully");
      }
    } catch (webhookError) {
      console.error('Discord webhook error:', webhookError);
    }

    logStep("Subscription granted successfully");

    return new Response(JSON.stringify({
      success: true,
      message: `Abonnement ${plan.name} offert à ${targetProfile?.username || targetUser.user.email}`,
      subscription_end: subscriptionEnd
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