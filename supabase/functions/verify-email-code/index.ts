import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface VerifyCodeRequest {
  email: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    const requestData: VerifyCodeRequest = await req.json();
    
    // Validate required fields
    if (!requestData.email || !requestData.code) {
      return new Response(
        JSON.stringify({ 
          error: 'Email et code requis',
          success: false 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, code } = requestData;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          error: 'Format d\'email invalide',
          success: false 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ 
          error: 'Code invalide (doit être 6 chiffres)',
          success: false 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Configuration Supabase manquante');
      return new Response(
        JSON.stringify({ 
          error: 'Erreur de configuration du serveur',
          success: false 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Chercher le code valide et non utilisé
    const { data, error } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Erreur DB lors de la vérification:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la vérification',
          success: false 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!data || data.length === 0) {
      console.log('Code invalide ou expiré:', { email, code });
      return new Response(
        JSON.stringify({ 
          error: 'Code invalide ou expiré',
          success: false 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Marquer le code comme utilisé
    const { error: updateError } = await supabase
      .from('email_verification_codes')
      .update({ used: true })
      .eq('id', data[0].id);

    if (updateError) {
      console.error('Erreur mise à jour code:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la vérification',
          success: false 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log('✅ Code vérifié avec succès:', { 
      email, 
      code: code.replace(/./g, '*'),
      codeId: data[0].id 
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Code vérifié avec succès',
        verified: true
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Erreur lors de la vérification du code:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);