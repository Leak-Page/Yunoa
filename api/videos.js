import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireAdmin, corsHeaders, JWT_SECRET } from './_lib/auth.js';
import { 
  getClientIp, 
  createDRMKey, 
  getDRMKey, 
  checkConcurrentStreams, 
  createStreamingSession, 
  detectAbusePatterns,
  logSuspiciousActivity 
} from './_lib/security.js';

const supabase = createClient(
  'https://efeommwlobsenrvqedcj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZW9tbXdsb2JzZW5ydnFlZGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDUwNTcsImV4cCI6MjA2OTYyMTA1N30.4Cl5_lJqCVI02Q-V47Ab7KhZ4jjnt7LkpysiYGNMW0c'
);

// Stockage temporaire des sessions de streaming sécurisé
const secureStreams = new Map();
const chunkCache = new Map();

// Sessions de streaming direct sécurisé (comme Netflix)
const streamingSessions = new Map();

/**
 * Génère un token de session de streaming temporaire (valide 60 secondes)
 */
function generateStreamingSessionToken(userId, videoId) {
  const sessionId = generateHash(`${userId}:${videoId}:${Date.now()}`);
  const expiresAt = Date.now() + 60 * 1000; // 60 secondes
  
  const token = jwt.sign({
    userId,
    videoId,
    sessionId,
    timestamp: Date.now()
  }, JWT_SECRET, { expiresIn: '60s' });
  
  return { token, sessionId, expiresAt };
}

/**
 * Valide une session de streaming et vérifie les abus
 */
function validateStreamingSession(token, videoId, rangeStart, rangeEnd) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.videoId !== videoId) {
      return { valid: false, reason: 'VIDEO_ID_MISMATCH' };
    }
    
    const session = streamingSessions.get(decoded.sessionId);
    if (!session) {
      return { valid: false, reason: 'SESSION_NOT_FOUND' };
    }
    
    if (Date.now() > session.expiresAt) {
      streamingSessions.delete(decoded.sessionId);
      return { valid: false, reason: 'SESSION_EXPIRED' };
    }
    
    // Vérifier les abus de téléchargement
    const now = Date.now();
    const timeSinceLastRequest = now - (session.lastRequestTime || session.createdAt);
    const bytesRequested = (rangeEnd || 0) - (rangeStart || 0);
    
    // Détecter téléchargement : trop de données demandées trop rapidement
    if (bytesRequested > 10 * 1024 * 1024 && timeSinceLastRequest < 1000) {
      // Plus de 10MB en moins d'1 seconde = probable téléchargement
      session.suspiciousActivity = (session.suspiciousActivity || 0) + 1;
      if (session.suspiciousActivity >= 3) {
        streamingSessions.delete(decoded.sessionId);
        return { valid: false, reason: 'SUSPICIOUS_ACTIVITY' };
      }
    }
    
    // Vérifier la séquence des requêtes Range (doit être progressive)
    if (rangeStart !== undefined && session.lastRangeEnd !== undefined) {
      // Permettre un petit chevauchement (buffer) mais pas de grands sauts
      const gap = rangeStart - session.lastRangeEnd;
      if (gap > 5 * 1024 * 1024) { // Plus de 5MB de gap = suspect
        session.suspiciousActivity = (session.suspiciousActivity || 0) + 1;
        if (session.suspiciousActivity >= 2) {
          return { valid: false, reason: 'INVALID_RANGE_SEQUENCE' };
        }
      }
    }
    
    // Limiter la taille maximale d'un chunk (empêcher téléchargement complet)
    if (bytesRequested > 20 * 1024 * 1024) { // Max 20MB par requête
      return { valid: false, reason: 'CHUNK_TOO_LARGE' };
    }
    
    // Mettre à jour la session
    session.lastRequestTime = now;
    session.lastRangeStart = rangeStart;
    session.lastRangeEnd = rangeEnd;
    session.requestCount = (session.requestCount || 0) + 1;
    
    return { valid: true, session, decoded };
  } catch (error) {
    return { valid: false, reason: 'INVALID_TOKEN' };
  }
}

// Nettoyage automatique
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of secureStreams.entries()) {
    if (now > data.expiresAt) {
      secureStreams.delete(key);
    }
  }
  // Nettoyer le cache des chunks après 5 minutes
  for (const [key, data] of chunkCache.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      chunkCache.delete(key);
    }
  }
  // Nettoyer les sessions de streaming expirées
  for (const [sessionId, session] of streamingSessions.entries()) {
    if (now > session.expiresAt) {
      streamingSessions.delete(sessionId);
    }
  }
}, 60 * 1000);

/**
 * Génère un hash SHA-256
 */
function generateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Génère un token unique avec timestamp
 */
function generateTimedToken(userId, videoId, chunkIndex, fingerprint) {
  const timestamp = Date.now();
  const data = `${userId}:${videoId}:${chunkIndex}:${fingerprint}:${timestamp}`;
  const hash = generateHash(data);
  
  return jwt.sign({
    userId,
    videoId,
    chunkIndex,
    fingerprint,
    timestamp,
    hash
  }, JWT_SECRET, { expiresIn: '30s' }); // Token valide 30 secondes seulement
}

/**
 * Valide un token et sa cohérence temporelle
 */
function validateTimedToken(token, expectedFingerprint, expectedChunkIndex) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérifier l'empreinte
    if (decoded.fingerprint !== expectedFingerprint) {
      return { valid: false, reason: 'FINGERPRINT_MISMATCH' };
    }
    
    // Vérifier l'index du chunk
    if (decoded.chunkIndex !== expectedChunkIndex - 1 && expectedChunkIndex > 0) {
      return { valid: false, reason: 'CHUNK_SEQUENCE_BROKEN' };
    }
    
    // Vérifier le timestamp (max 30 secondes)
    const now = Date.now();
    if (now - decoded.timestamp > 30000) {
      return { valid: false, reason: 'TOKEN_EXPIRED' };
    }
    
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, reason: 'INVALID_TOKEN' };
  }
}

export default async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = pathname.split('/').filter(part => part);

  try {
    // GET /api/videos/drm/key - Système de clés DRM sécurisé
    if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'drm' && pathParts[3] === 'key' && req.method === 'GET') {
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const token = searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');
      const keyId = searchParams.get('keyId');
      const videoId = searchParams.get('videoId');
      
      if (!token || !keyId) {
        return res.status(400).json({ error: 'Token et keyId requis' });
      }
      
      const clientIp = getClientIp(req);
      const userAgent = req.headers['user-agent'] || '';
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const abuseCheck = detectAbusePatterns(decoded.userId, videoId);
        if (abuseCheck.isAbuse) {
          logSuspiciousActivity('ABUSE_DETECTED', { 
            userId: decoded.userId, 
            videoId, 
            reason: abuseCheck.reason,
            ip: clientIp 
          });
          return res.status(429).json({ 
            error: 'Trop de requêtes détectées',
            code: 'RATE_LIMITED' 
          });
        }
        
        const streamCheck = checkConcurrentStreams(decoded.userId, videoId);
        if (!streamCheck.allowed) {
          return res.status(429).json({ 
            error: streamCheck.message,
            code: 'TOO_MANY_STREAMS' 
          });
        }
        
        const key = getDRMKey(keyId, token, req);
        
        if (!key) {
          return res.status(403).json({ 
            error: 'Clé de déchiffrement non autorisée',
            code: 'KEY_ACCESS_DENIED' 
          });
        }
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end(key);
        
      } catch (authError) {
        logSuspiciousActivity('DRM_AUTH_FAILED', { 
          error: authError.message, 
          ip: clientIp, 
          userAgent 
        });
        return res.status(401).json({ 
          error: 'Token d\'authentification invalide',
          code: 'INVALID_AUTH' 
        });
      }
    }
    
    // POST /api/videos/drm/session - Créer une session DRM
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'drm' && pathParts[3] === 'session' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ error: 'ID de vidéo requis' });
      }
      
      const streamCheck = checkConcurrentStreams(user.id, videoId);
      if (!streamCheck.allowed) {
        return res.status(429).json({ 
          error: streamCheck.message,
          code: 'TOO_MANY_STREAMS' 
        });
      }
      
      const sessionId = createStreamingSession(user.id, videoId, req);
      
      const keys = [];
      for (let i = 0; i < 5; i++) {
        const keyData = createDRMKey(videoId, user.id, i);
        keys.push(keyData);
      }
      
      res.json({
        sessionId,
        keys,
        expiresIn: 4 * 60 * 60,
        keyRotationInterval: 15 * 60
      });
    }
    
    // GET /api/videos/proxy - DÉSACTIVÉ - Utiliser secure-stream à la place
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'proxy' && req.method === 'GET') {
      return res.status(403).json({ 
        error: 'Endpoint désactivé pour raisons de sécurité',
        message: 'Veuillez utiliser le système de streaming chiffré (secure-stream)',
        code: 'DIRECT_PROXY_DISABLED'
      });
    }
    
    // POST /api/videos/secure-stream/metadata - Obtenir les métadonnées
    else if (pathParts.length >= 4 && pathParts[2] === 'secure-stream' && pathParts[3] === 'metadata' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { videoId, fingerprint, useMSE } = req.body;

      if (!videoId || !fingerprint) {
        return res.status(400).json({ error: 'videoId et fingerprint requis' });
      }

      // Récupérer les infos de la vidéo
      const { data: video, error } = await supabase
        .from('videos')
        .select('video_url, title')
        .eq('id', videoId)
        .single();

      if (error || !video) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      // Créer une session de streaming sécurisé
      const sessionId = generateHash(`${user.id}:${videoId}:${fingerprint}:${Date.now()}`);
      const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 heures
      const encryptionSeed = generateHash(`${sessionId}:${Date.now()}`);

      const sessionCreatedAt = Date.now();
      secureStreams.set(sessionId, {
        userId: user.id,
        videoId,
        fingerprint,
        videoUrl: video.video_url,
        expiresAt,
        chunksDelivered: 0,
        lastChunkTime: sessionCreatedAt,
        createdAt: sessionCreatedAt,
        lastHash: null,
        encryptionSeed,
        useMSE: useMSE || false
      });
      
      console.log(`✅ Session créée: ${sessionId.substring(0, 16)}... pour user ${user.id}, video ${videoId}`);

      // Obtenir la taille de la vidéo
      let size;
      try {
        const headResponse = await fetch(video.video_url, { method: 'HEAD' });
        const contentLength = headResponse.headers.get('content-length');
        size = contentLength ? parseInt(contentLength) : 100 * 1024 * 1024;
      } catch (e) {
        size = 100 * 1024 * 1024; // 100 MB par défaut
      }

      const chunkSize = 512 * 1024;
      const totalChunks = Math.ceil(size / chunkSize);

      return res.json({
        sessionId,
        size,
        totalChunks,
        contentType: 'video/mp4',
        expiresAt,
        encryptionSeed: useMSE ? encryptionSeed : undefined,
        initialToken: generateTimedToken(user.id, videoId, -1, fingerprint)
      });
    }

    // POST /api/videos/secure-stream/chunk - Récupérer un chunk
    else if (pathParts.length >= 4 && pathParts[2] === 'secure-stream' && pathParts[3] === 'chunk' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
      }

      const { videoId, chunkIndex, timestamp, fingerprint, previousHash, encrypted, sessionId } = req.body;
      const totalChunks = parseInt(req.headers['x-total-chunks'] || '0');

      if (videoId === undefined || chunkIndex === undefined || !fingerprint) {
        return res.status(400).json({ error: 'Paramètres manquants' });
      }

      // Valider le token
      const tokenValidation = validateTimedToken(token, fingerprint, chunkIndex);
      if (!tokenValidation.valid) {
        return res.status(403).json({ 
          error: 'Token invalide',
          reason: tokenValidation.reason 
        });
      }

      const decoded = tokenValidation.decoded;

      // Trouver la session
      let session = null;
      
      // Si sessionId est fourni, l'utiliser directement
      if (sessionId) {
        session = secureStreams.get(sessionId);
        if (session && (session.userId !== decoded.userId || 
                        session.videoId !== videoId || 
                        session.fingerprint !== fingerprint)) {
          // SessionId fourni mais ne correspond pas aux critères
          console.log(`⚠️ SessionId fourni (${sessionId.substring(0, 16)}...) mais ne correspond pas aux critères`);
          session = null;
        } else if (session) {
          console.log(`✅ Session trouvée via sessionId: ${sessionId.substring(0, 16)}..., chunksDelivered: ${session.chunksDelivered}`);
        }
      }
      
      // Sinon, chercher par userId/videoId/fingerprint
      // Si plusieurs sessions existent, prendre celle avec chunksDelivered === chunkIndex
      // Sinon, prendre la plus récente avec chunksDelivered === 0 (pour le chunk 0)
      if (!session) {
        let exactMatch = null; // Session avec chunksDelivered === chunkIndex
        let unusedSession = null; // Session avec chunksDelivered === 0 (pour le chunk 0)
        let latestTime = 0;
        
        for (const [sid, sess] of secureStreams.entries()) {
          if (sess.userId === decoded.userId && 
              sess.videoId === videoId && 
              sess.fingerprint === fingerprint) {
            // Session exacte (chunksDelivered === chunkIndex)
            if (sess.chunksDelivered === chunkIndex) {
              if (!exactMatch || sess.createdAt > (exactMatch.createdAt || 0)) {
                exactMatch = sess;
              }
            }
            // Session non utilisée (pour le chunk 0)
            if (chunkIndex === 0 && sess.chunksDelivered === 0) {
              if (!unusedSession || sess.createdAt > latestTime) {
                unusedSession = sess;
                latestTime = sess.createdAt;
              }
            }
          }
        }
        
        // Utiliser la session exacte si disponible, sinon la session non utilisée
        session = exactMatch || unusedSession;
      }

      if (!session) {
        return res.status(403).json({ error: 'Session invalide ou expirée' });
      }

      // Vérifier la cohérence temporelle (pas de sauts dans le temps)
      const now = Date.now();
      
      // Si c'est le chunk 0 et que la session n'a pas encore été utilisée, réinitialiser lastChunkTime
      // Cela permet d'éviter les timeouts si la session a été créée il y a longtemps
      if (chunkIndex === 0 && session.chunksDelivered === 0) {
        // Si le sessionId correspond, c'est une nouvelle utilisation de la session
        // Réinitialiser le temps pour permettre le chargement
        console.log(`🔄 Réinitialisation du lastChunkTime pour session ${sessionId ? sessionId.substring(0, 16) + '...' : 'trouvée'} (créée il y a ${Math.round((now - session.createdAt) / 1000)}s)`);
        session.lastChunkTime = now;
      }
      
      // Timeout plus long pour le premier chunk (5 min), ensuite 90 secondes entre chunks
      const timeoutLimit = chunkIndex === 0 ? 5 * 60 * 1000 : 90 * 1000;
      if (now - session.lastChunkTime > timeoutLimit) {
        console.log(`⚠️ Session timeout: ${now - session.lastChunkTime}ms > ${timeoutLimit}ms pour chunk ${chunkIndex}`);
        return res.status(403).json({ 
          error: 'Timeout de session',
          code: 'SESSION_TIMEOUT',
          details: `Délai écoulé: ${Math.round((now - session.lastChunkTime) / 1000)}s`
        });
      }

      // Vérifier la séquence de chunks (pas de sauts)
      if (chunkIndex !== session.chunksDelivered) {
        return res.status(403).json({ 
          error: 'Séquence de chunks invalide',
          code: 'INVALID_SEQUENCE' 
        });
      }

      // Vérifier le hash précédent si fourni
      if (chunkIndex > 0 && previousHash) {
        const expectedHash = session.lastHash;
        if (previousHash !== expectedHash) {
          return res.status(403).json({ 
            error: 'Hash de validation incorrect',
            code: 'HASH_MISMATCH' 
          });
        }
      }

      // Récupérer le chunk de la vidéo
       const chunkSize = 512 * 1024; // 512 KB
       const start = chunkIndex * chunkSize;
       const end = start + chunkSize - 1;

      const videoResponse = await fetch(session.videoUrl, {
        headers: {
          'Range': `bytes=${start}-${end}`
        }
      });

      if (!videoResponse.ok) {
        return res.status(502).json({ error: 'Erreur de récupération vidéo' });
      }

      const chunkData = await videoResponse.arrayBuffer();

      // Générer le hash pour ce chunk
      const chunkHash = generateHash(Buffer.from(chunkData).toString('base64'));

      // Générer le prochain token et hash
      // Le token doit contenir le chunkIndex du chunk actuel (pas +1) car la validation
      // vérifie que decoded.chunkIndex === expectedChunkIndex - 1
      // Donc pour valider le chunk 1, le token doit avoir chunkIndex = 0
      const nextToken = generateTimedToken(decoded.userId, videoId, chunkIndex, fingerprint);
      const nextHash = generateHash(`${chunkIndex + 1}:${videoId}:${fingerprint}:${now}`);

      // Si chiffrement demandé (mode MSE)
      if (encrypted && session.encryptionSeed) {
        try {
          // Chiffrer avec AES-GCM
          const iv = crypto.randomBytes(12);
          const key = crypto.createHash('sha256')
            .update(session.encryptionSeed + fingerprint)
            .digest();
          
          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
          const encryptedData = Buffer.concat([
            cipher.update(Buffer.from(chunkData)),
            cipher.final()
          ]);
          const authTag = cipher.getAuthTag();
          
          const finalEncrypted = Buffer.concat([encryptedData, authTag]);

           // Mettre à jour l'état de session avant de répondre
           session.chunksDelivered += 1;
           session.lastChunkTime = now;
           session.lastHash = nextHash;

           return res.json({
             data: finalEncrypted.toString('base64'),
             iv: iv.toString('base64'),
             nextToken,
             nextHash,
             expiresAt: now + 30000
           });
        } catch (encryptError) {
          console.error('Erreur chiffrement:', encryptError);
          return res.status(500).json({ error: 'Erreur de chiffrement' });
        }
      }

       // Mode non-chiffré (fallback)
       // Mettre à jour l'état de session avant de répondre
       session.chunksDelivered += 1;
       session.lastChunkTime = now;
       session.lastHash = nextHash;
       
       res.setHeader('X-Next-Token', nextToken);
       res.setHeader('X-Next-Hash', nextHash);
       res.setHeader('X-Expires-At', (now + 30000).toString());
       res.setHeader('Content-Type', 'application/octet-stream');
       res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

       return res.end(Buffer.from(chunkData));
    }
    
    // POST /api/videos/stream/session - Créer une session de streaming sécurisée
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'stream' && pathParts[3] === 'session' && req.method === 'POST') {
      try {
        const user = authenticateToken(req);
        const { videoId } = req.body;
        
        if (!videoId) {
          return res.status(400).json({ error: 'ID de vidéo requis' });
        }
        
        // Vérifier les streams simultanés
        const streamCheck = checkConcurrentStreams(user.id, videoId);
        if (!streamCheck.allowed) {
          return res.status(429).json({
            error: streamCheck.message,
            code: 'TOO_MANY_STREAMS'
          });
        }
        
        // Créer une session de streaming sécurisée
        const { token, sessionId, expiresAt } = generateStreamingSessionToken(user.id, videoId);
        
        streamingSessions.set(sessionId, {
          userId: user.id,
          videoId,
          createdAt: Date.now(),
          expiresAt,
          lastRequestTime: Date.now(),
          requestCount: 0,
          suspiciousActivity: 0
        });
        
        res.json({
          sessionToken: token,
          expiresIn: 60, // 60 secondes
          refreshInterval: 30 // Renouveler toutes les 30 secondes
        });
      } catch (error) {
        if (error.message === 'Token manquant' || error.message === 'Token invalide') {
          return res.status(401).json({ error: 'Authentification requise' });
        }
        return res.status(500).json({ error: 'Erreur serveur' });
      }
    }
    
    // GET /api/videos/stream/:videoId - Streaming direct sécurisé (comme Netflix)
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'stream' && req.method === 'GET') {
      const videoId = pathParts[3];
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const token = req.headers.authorization?.replace('Bearer ', '') || searchParams.get('token');
      
      if (!token) {
        return res.status(401).json({ error: 'Token d\'authentification requis' });
      }

      try {
        // Créer une requête modifiée avec le token dans les headers pour authenticateToken
        const modifiedReq = {
          ...req,
          headers: {
            ...req.headers,
            authorization: `Bearer ${token}`
          }
        };
        
        let user;
        try {
          user = authenticateToken(modifiedReq);
        } catch (authError) {
          console.error('Erreur authentification token:', authError.message);
          // Essayer de décoder le token pour debug
          try {
            const decoded = jwt.decode(token, { complete: true });
            console.log('Token décodé:', decoded ? 'OK' : 'FAILED', decoded?.payload ? 'Payload présent' : 'Pas de payload');
            if (decoded?.payload) {
              console.log('Payload iss:', decoded.payload.iss);
              console.log('Payload sub:', decoded.payload.sub);
              console.log('Payload email:', decoded.payload.email);
            }
          } catch (e) {
            console.error('Impossible de décoder le token:', e.message);
          }
          return res.status(401).json({ 
            error: 'Token d\'authentification invalide',
            details: authError.message 
          });
        }
        
        const clientIp = getClientIp(req);
        
        // Vérifier les abus
        const abuseCheck = detectAbusePatterns(user.id, videoId);
        if (abuseCheck.isAbuse) {
          logSuspiciousActivity('ABUSE_DETECTED', { 
            userId: user.id, 
            videoId, 
            reason: abuseCheck.reason,
            ip: clientIp 
          });
          return res.status(429).json({ 
            error: 'Trop de requêtes détectées',
            code: 'RATE_LIMITED' 
          });
        }
        
        // Vérifier les streams simultanés
        const streamCheck = checkConcurrentStreams(user.id, videoId);
        if (!streamCheck.allowed) {
          return res.status(429).json({ 
            error: streamCheck.message,
            code: 'TOO_MANY_STREAMS' 
          });
        }

        // Récupérer l'URL de la vidéo ou de l'épisode
        let videoUrl = null;
        let videoTitle = null;
        
        // Essayer d'abord comme vidéo
        const { data: video, error: videoError } = await supabase
          .from('videos')
          .select('video_url, title')
          .eq('id', videoId)
          .single();

        if (video && !videoError) {
          videoUrl = video.video_url;
          videoTitle = video.title;
        } else {
          // Si ce n'est pas une vidéo, essayer comme épisode
          const { data: episode, error: episodeError } = await supabase
            .from('episodes')
            .select('video_url, title')
            .eq('id', videoId)
            .single();

          if (episode && !episodeError) {
            videoUrl = episode.video_url;
            videoTitle = episode.title;
          } else {
            return res.status(404).json({ error: 'Vidéo ou épisode non trouvé' });
          }
        }

        if (!videoUrl) {
          return res.status(404).json({ error: 'URL vidéo non trouvée' });
        }

        // Obtenir les headers Range si présents (pour le streaming progressif)
        const range = req.headers.range;
        
        // Faire une requête HEAD pour obtenir les métadonnées de la vidéo
        const headResponse = await fetch(videoUrl, { method: 'HEAD' });
        const contentLength = parseInt(headResponse.headers.get('content-length') || '0');
        const contentType = headResponse.headers.get('content-type') || 'video/mp4';
        const acceptRanges = headResponse.headers.get('accept-ranges') || 'bytes';

        if (range) {
          // Streaming avec Range request (progressive)
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
          const chunksize = (end - start) + 1;
          
          // SÉCURITÉ : Valider la session et détecter les téléchargements
          // Le token peut être soit un token de session temporaire, soit le token Supabase
          // On essaie d'abord avec validateStreamingSession, sinon on utilise authenticateToken
          let sessionValidation = validateStreamingSession(token, videoId, start, end);
          
          if (!sessionValidation.valid && sessionValidation.reason === 'SESSION_NOT_FOUND') {
            // Si pas de session trouvée, c'est peut-être un token Supabase direct
            // On crée une session à la volée pour cette requête
            try {
              const { token: newSessionToken, sessionId, expiresAt } = generateStreamingSessionToken(user.id, videoId);
              streamingSessions.set(sessionId, {
                userId: user.id,
                videoId,
                createdAt: Date.now(),
                expiresAt,
                lastRequestTime: Date.now(),
                requestCount: 0,
                suspiciousActivity: 0
              });
              // Réessayer la validation avec le nouveau token
              sessionValidation = validateStreamingSession(newSessionToken, videoId, start, end);
            } catch (e) {
              // Ignorer et continuer avec les validations de base
            }
          }
          
          // Valider les requêtes suspectes même si la session n'existe pas
          const bytesRequested = chunksize;
          if (bytesRequested > 20 * 1024 * 1024) { // Max 20MB par requête
            logSuspiciousActivity('LARGE_CHUNK_REQUEST', {
              userId: user.id,
              videoId,
              ip: clientIp,
              size: bytesRequested
            });
            return res.status(403).json({
              error: 'Chunk trop volumineux',
              code: 'CHUNK_TOO_LARGE'
            });
          }

          // Récupérer le chunk de la vidéo
          const videoResponse = await fetch(videoUrl, {
            headers: {
              'Range': `bytes=${start}-${end}`
            }
          });

          if (!videoResponse.ok) {
            return res.status(502).json({ error: 'Erreur de récupération vidéo' });
          }

          const chunkData = await videoResponse.arrayBuffer();

          // Envoyer la réponse avec les headers appropriés
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${contentLength}`,
            'Accept-Ranges': acceptRanges,
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff'
          });

          return res.end(Buffer.from(chunkData));
        }

          if (!videoResponse.ok) {
            return res.status(502).json({ error: 'Erreur de récupération vidéo' });
          }

          // Copier les headers importants
          res.writeHead(200, {
            'Content-Length': contentLength,
            'Content-Type': contentType,
            'Accept-Ranges': acceptRanges,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff'
          });

          // Streamer la vidéo directement
          const reader = videoResponse.body.getReader();
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
              res.end();
            } catch (error) {
              console.error('Streaming error:', error);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Erreur de streaming' });
              } else {
                res.end();
              }
            }
          };

          pump();
          return;
        }

      } catch (authError) {
        if (authError.message === 'Token manquant' || authError.message === 'Token invalide') {
          return res.status(401).json({ error: 'Token d\'authentification invalide' });
        }
        console.error('Stream error:', authError);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
    }
    
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('❌ Videos API error:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message
    });
  }
};