import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'streamflix-secret-key-2024';

function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('Token manquant');
  }

  try {
    // Décoder le token pour vérifier son format
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || !decoded.payload) {
      throw new Error('Token invalide');
    }
    
    const payload = decoded.payload;
    
    // Si c'est un token Supabase, on fait une validation simple
    if (payload.iss && payload.iss.includes('supabase')) {
      // Validation basique pour Supabase
      if (!payload.sub || !payload.email) {
        throw new Error('Token Supabase invalide');
      }
      
      // Vérifier l'expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('Token expiré');
      }
      
      // Retourner un objet compatible
      return {
        id: payload.sub,
        userId: payload.sub,
        email: payload.email,
        role: payload.user_metadata?.role || 'membre'
      };
    } else {
      // Token legacy
      const user = jwt.verify(token, JWT_SECRET);
      return user;
    }
  } catch (err) {
    throw new Error('Token invalide');
  }
}

function requireAdmin(user) {
  if (user.role !== 'admin') {
    throw new Error('Accès admin requis');
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export { authenticateToken, requireAdmin, corsHeaders, JWT_SECRET };