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
// SÉCURITÉ : Suivi des requêtes par IP pour détecter les téléchargements
const requestTracker = new Map(); // IP -> { count, lastRequest, videoId }

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
  // Nettoyer le tracker de requêtes après 5 minutes d'inactivité
  for (const [key, tracker] of requestTracker.entries()) {
    if (now - tracker.lastRequest > 5 * 60 * 1000) {
      requestTracker.delete(key);
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
    // POST /api/videos/stream-url - Obtenir une URL signée pour le streaming direct
    if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'stream-url' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { videoId } = req.body;

      if (!videoId) {
        return res.status(400).json({ error: 'ID de vidéo requis' });
      }

      // Récupérer les infos de la vidéo
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('video_url, title')
        .eq('id', videoId)
        .single();

      if (videoError || !video || !video.video_url) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      // SÉCURITÉ : Générer un token signé pour l'URL (valide 5 minutes seulement)
      // Le token doit être renouvelé régulièrement pour empêcher le téléchargement
      const token = jwt.sign(
        {
          userId: user.id,
          videoId: videoId,
          url: video.video_url,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes seulement
        },
        JWT_SECRET
      );

      // Créer une URL signée (proxy interne)
      const signedUrl = `${req.protocol || 'https'}://${req.headers.host}/api/videos/stream?token=${encodeURIComponent(token)}`;

      return res.json({
        signedUrl,
        expiresIn: 3600
      });
    }

    // GET /api/videos/stream - Proxy pour le streaming avec token signé et validation stricte
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'stream' && req.method === 'GET') {
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const token = searchParams.get('token');
      const rangeHeader = req.headers.range;

      if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const videoUrl = decoded.url;
        const userId = decoded.userId;
        const videoId = decoded.videoId;

        // SÉCURITÉ : Vérifier que le token n'est pas trop vieux (max 5 minutes)
        const tokenAge = Date.now() / 1000 - decoded.iat;
        if (tokenAge > 300) { // 5 minutes
          return res.status(401).json({ error: 'Token expiré' });
        }

        // SÉCURITÉ : Vérifier l'User-Agent pour détecter les extensions de téléchargement
        const userAgent = req.headers['user-agent'] || '';
        const suspiciousAgents = ['Video DownloadHelper', 'youtube-dl', 'wget', 'curl', 'aria2', 'ffmpeg', 'VLC'];
        if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent.toLowerCase()))) {
          logSuspiciousActivity('SUSPICIOUS_USER_AGENT', { 
            userId, 
            videoId, 
            userAgent,
            ip: getClientIp(req)
          });
          return res.status(403).json({ error: 'Accès refusé' });
        }

        // SÉCURITÉ : Vérifier le Referer pour s'assurer que la requête vient du site
        const referer = req.headers.referer || req.headers.origin || '';
        if (!referer.includes(req.headers.host)) {
          logSuspiciousActivity('SUSPICIOUS_REFERER', { 
            userId, 
            videoId, 
            referer,
            ip: getClientIp(req)
          });
          // Ne pas bloquer complètement, mais logger
        }

        // SÉCURITÉ : Limiter le nombre de requêtes par IP pour détecter les téléchargements
        const clientIp = getClientIp(req);
        const now = Date.now();
        const trackerKey = `${clientIp}_${videoId}`;
        const tracker = requestTracker.get(trackerKey) || { count: 0, lastRequest: 0, videoId };
        
        // Réinitialiser le compteur si plus de 1 minute depuis la dernière requête
        if (now - tracker.lastRequest > 60000) {
          tracker.count = 0;
        }
        
        tracker.count++;
        tracker.lastRequest = now;
        requestTracker.set(trackerKey, tracker);
        
        // Bloquer si trop de requêtes (plus de 100 requêtes par minute = téléchargement)
        if (tracker.count > 100) {
          logSuspiciousActivity('EXCESSIVE_REQUESTS', { 
            userId, 
            videoId, 
            count: tracker.count,
            ip: clientIp
          });
          return res.status(429).json({ error: 'Trop de requêtes' });
        }

        // SÉCURITÉ : Vérifier et valider le Range header
        let range = rangeHeader;
        
        // Obtenir la taille réelle de la vidéo d'abord
        const headResponse = await fetch(videoUrl, { method: 'HEAD' });
        const contentLength = headResponse.headers.get('content-length');
        const videoSize = contentLength ? parseInt(contentLength) : 0;
        
        if (range) {
          const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : null;
            
            // Vérifier que le range est valide
            if (start < 0 || (end !== null && end < start)) {
              return res.status(416).json({ error: 'Range Not Satisfiable' });
            }
            
            // Si on a la taille, vérifier qu'on ne dépasse pas
            if (videoSize > 0 && (start >= videoSize || (end !== null && end >= videoSize))) {
              return res.status(416).json({ error: 'Range Not Satisfiable' });
            }
            
            // Limiter à 20MB par requête maximum pour le streaming
            const maxChunkSize = 20 * 1024 * 1024;
            if (end === null) {
              // Pas de fin spécifiée, limiter à maxChunkSize
              const actualEnd = videoSize > 0 
                ? Math.min(start + maxChunkSize - 1, videoSize - 1)
                : start + maxChunkSize - 1;
              range = `bytes=${start}-${actualEnd}`;
            } else if ((end - start) > maxChunkSize) {
              // Range trop grand, limiter
              range = `bytes=${start}-${start + maxChunkSize - 1}`;
            }
          }
        } else {
          // SÉCURITÉ : Si pas de Range header, limiter à 2MB (pour les métadonnées seulement)
          range = videoSize > 0 
            ? `bytes=0-${Math.min(2097151, videoSize - 1)}`
            : 'bytes=0-2097151'; // 2MB
        }
        
        // Faire une requête proxy vers la vidéo avec Range limité
        const videoResponse = await fetch(videoUrl, {
          headers: { 'Range': range }
        });

        if (!videoResponse.ok && videoResponse.status !== 206) {
          return res.status(videoResponse.status).json({ error: 'Erreur de récupération vidéo' });
        }

        // SÉCURITÉ : Headers pour empêcher la mise en cache et le téléchargement
        const headers = {
          'Content-Type': videoResponse.headers.get('content-type') || 'video/mp4',
          'Content-Length': videoResponse.headers.get('content-length') || '',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache, no-store, must-revalidate, private',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Disposition': 'inline; filename="stream.mp4"', // inline empêche le téléchargement
          'X-Robots-Tag': 'noindex, nofollow', // Empêcher l'indexation
          'Cross-Origin-Resource-Policy': 'same-origin' // Empêcher l'accès cross-origin
        };

        if (videoResponse.status === 206) {
          headers['Content-Range'] = videoResponse.headers.get('content-range') || '';
        }

        Object.entries(headers).forEach(([key, value]) => {
          if (value) res.setHeader(key, value);
        });

        res.status(videoResponse.status);

        // Streamer la réponse
        const buffer = await videoResponse.arrayBuffer();
        return res.end(Buffer.from(buffer));

      } catch (error) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
      }
    }

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
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('video_url, title')
        .eq('id', videoId)
        .single();

      if (videoError) {
        console.error('❌ Erreur Supabase:', videoError);
        return res.status(404).json({ error: 'Vidéo non trouvée', details: videoError.message });
      }

      if (!video || !video.video_url) {
        return res.status(404).json({ error: 'Vidéo non trouvée ou URL manquante' });
      }

      // Créer une session de streaming sécurisé
      const sessionId = generateHash(`${user.id}:${videoId}:${fingerprint}:${Date.now()}`);
      const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 heures
      const encryptionSeed = generateHash(`${sessionId}:${Date.now()}`);
      
      // Taille de chunk par défaut : 1MB pour un chargement plus rapide
      const defaultChunkSize = 1024 * 1024; // 1MB

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
        useMSE: useMSE || false,
        chunkSize: defaultChunkSize // Stocker la taille de chunk dans la session
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

      // Calculer le nombre total de chunks avec la taille de chunk par défaut
      const totalChunks = Math.ceil(size / defaultChunkSize);

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
      
      // Timeout plus long pour permettre un chargement séquentiel
      // Premier chunk : 5 minutes, ensuite 5 minutes entre chunks (pour permettre un chargement progressif)
      const timeoutLimit = chunkIndex === 0 ? 5 * 60 * 1000 : 5 * 60 * 1000;
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
       // Utiliser la taille de chunk de la session (1MB par défaut)
       const chunkSize = session.chunkSize || 1024 * 1024; // 1MB par défaut
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