import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  const { method } = req

  // ✅ Réponse au preflight OPTIONS
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const url = new URL(req.url)
    console.log('🔗 URL pathname:', url.pathname);
    console.log('🔗 Method:', method);

    // 🔎 GET /admin-users OU POST sans body → récupérer profils + emails
    if ((method === 'GET' && url.pathname === '/admin-users') || 
        (method === 'POST' && url.pathname === '/admin-users')) {
      
      // Si c'est POST, vérifier s'il y a un body avec userId (pour suppression)
      if (method === 'POST') {
        try {
          const text = await req.text();
          console.log('📄 Body reçu:', text);
          
          if (text.trim()) {
            const body = JSON.parse(text);
            const userId = body?.userId;
            
            if (userId) {
              // C'est une demande de suppression
              console.log('🗑️ Suppression demandée pour:', userId);
              const { error } = await supabase.auth.admin.deleteUser(userId);
              
              if (error) throw error;
              
              return new Response(JSON.stringify({ message: 'Utilisateur supprimé avec succès' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
          // Pas de body ou pas d'userId, traiter comme une demande de récupération
        } catch (parseError) {
          console.log('⚠️ Pas de JSON valide, traiter comme GET');
        }
      }
      
      // Récupération des utilisateurs
      console.log('📋 Récupération des utilisateurs...');
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      const usersWithEmails = await Promise.all(
        (profiles || []).map(async (profile) => {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
            return {
              ...profile,
              email: authUser?.user?.email || 'Email non disponible',
              createdAt: profile.created_at,
              avatar_url: profile.avatar, // Map for compatibility
            }
          } catch {
            return {
              ...profile,
              email: 'Email non disponible',
              createdAt: profile.created_at,
              avatar_url: profile.avatar, // Map for compatibility
            }
          }
        })
      )

      return new Response(JSON.stringify(usersWithEmails), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ❌ Route non reconnue
    return new Response(JSON.stringify({ error: 'Route non trouvée' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || 'Erreur inconnue' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
