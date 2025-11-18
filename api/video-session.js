import { corsHeaders, authenticateToken } from './_lib/auth.js';
import { generateVideoSessionToken, getClientIp, isVpnIp } from './_lib/security.js';

export default async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      // Vérifier l'authentification
      const user = authenticateToken(req);
      
      // Obtenir l'IP du client
      const clientIp = getClientIp(req);
      
      // Vérifier si c'est un VPN (optionnel - peut être désactivé)
      if (isVpnIp(clientIp)) {
        return res.status(403).json({ 
          error: 'Accès non autorisé depuis un VPN',
          code: 'VPN_BLOCKED' 
        });
      }
      
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ error: 'ID de vidéo requis' });
      }
      
      // Générer un token de session pour cette vidéo
      const sessionToken = generateVideoSessionToken(user.id, videoId);
      
      res.json({ 
        sessionToken,
        expiresIn: 4 * 60 * 60 // 4 heures en secondes
      });
      
    } catch (error) {
      console.error('Video session error:', error);
      if (error.message === 'Token manquant' || error.message === 'Token invalide') {
        return res.status(401).json({ error: 'Authentification requise' });
      }
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } else {
    res.status(405).json({ error: 'Méthode non autorisée' });
  }
};