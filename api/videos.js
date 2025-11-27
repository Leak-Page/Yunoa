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
import { executeQuery, handleDbError } from './_lib/db.js';

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
    // Ne supprimer que si la session est vraiment expirée (avec une marge de 1 minute)
    if (now > (data.expiresAt + 60 * 1000)) {
      secureStreams.delete(key);
      console.log('[Cleanup] Session supprimée:', key.substring(0, 16) + '...', 'type:', data.type || 'unknown');
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

        // SÉCURITÉ : Vérifier le Referer/Origin - Logger mais ne pas bloquer si manquant (peut être normal pour les requêtes vidéo)
        const referer = req.headers.referer || '';
        const origin = req.headers.origin || '';
        const host = req.headers.host || '';
        
        // Vérifier que la requête vient bien du site
        const isValidReferer = referer && (referer.includes(host) || referer.includes('yunoa.xyz'));
        const isValidOrigin = origin && (origin.includes(host) || origin.includes('yunoa.xyz'));
        
        // Si on a un Referer ou Origin, il doit être valide
        // Mais on ne bloque pas si les deux sont absents (peut être normal pour certaines requêtes vidéo)
        if ((referer || origin) && !isValidReferer && !isValidOrigin) {
          logSuspiciousActivity('INVALID_REFERER_ORIGIN', { 
            userId, 
            videoId, 
            referer,
            origin,
            ip: getClientIp(req),
            userAgent
          });
          return res.status(403).json({ error: 'Accès refusé - Requête non autorisée' });
        }

        // SÉCURITÉ : Limiter le nombre de requêtes par IP pour détecter les téléchargements
        const clientIp = getClientIp(req);
        const now = Date.now();
        const trackerKey = `${clientIp}_${videoId}`;
        const tracker = requestTracker.get(trackerKey) || { count: 0, lastRequest: 0, videoId, ranges: [] };
        
        // Réinitialiser le compteur si plus de 1 minute depuis la dernière requête
        if (now - tracker.lastRequest > 60000) {
          tracker.count = 0;
          tracker.ranges = [];
        }
        
        tracker.count++;
        tracker.lastRequest = now;
        
        // SÉCURITÉ : Détecter les patterns de téléchargement (requêtes séquentielles)
        if (rangeHeader) {
          const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            tracker.ranges.push({ start, time: now });
            
            // Détecter si on télécharge séquentiellement (pattern de téléchargement)
            // Seulement si on a beaucoup de requêtes (plus de 20) pour éviter les faux positifs
            if (tracker.ranges.length > 20) {
              const recentRanges = tracker.ranges.slice(-30);
              let sequentialCount = 0;
              let largeRangesCount = 0;
              
              for (let i = 1; i < recentRanges.length; i++) {
                if (recentRanges[i].start > recentRanges[i-1].start) {
                  sequentialCount++;
                }
                // Compter les ranges qui sont proches (pattern de téléchargement)
                const gap = recentRanges[i].start - recentRanges[i-1].start;
                if (gap > 0 && gap < 10 * 1024 * 1024) { // Moins de 10MB entre les requêtes
                  largeRangesCount++;
                }
              }
              
              // Si plus de 90% des requêtes sont séquentielles ET on a beaucoup de requêtes, c'est probablement un téléchargement
              const sequentialRatio = sequentialCount / recentRanges.length;
              if (sequentialRatio > 0.9 && tracker.count > 30) {
                logSuspiciousActivity('DOWNLOAD_PATTERN_DETECTED', { 
                  userId, 
                  videoId, 
                  sequentialCount,
                  totalRanges: recentRanges.length,
                  sequentialRatio: sequentialRatio.toFixed(2),
                  ip: clientIp
                });
                return res.status(403).json({ error: 'Accès refusé - Pattern de téléchargement détecté' });
              }
            }
          }
        }
        
        requestTracker.set(trackerKey, tracker);
        
        // Bloquer si trop de requêtes (plus de 50 requêtes par minute = téléchargement)
        if (tracker.count > 50) {
          logSuspiciousActivity('EXCESSIVE_REQUESTS', { 
            userId, 
            videoId, 
            count: tracker.count,
            ip: clientIp
          });
          return res.status(429).json({ error: 'Trop de requêtes - Accès temporairement bloqué' });
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
            
            // SÉCURITÉ : Limiter à 5MB par requête maximum pour empêcher le téléchargement complet
            const maxChunkSize = 5 * 1024 * 1024; // 5MB max par requête
            if (end === null) {
              // Pas de fin spécifiée, limiter à maxChunkSize
              const actualEnd = videoSize > 0 
                ? Math.min(start + maxChunkSize - 1, videoSize - 1)
                : start + maxChunkSize - 1;
              range = `bytes=${start}-${actualEnd}`;
            } else if ((end - start) > maxChunkSize) {
              // Range trop grand, limiter strictement
              range = `bytes=${start}-${start + maxChunkSize - 1}`;
            }
            
            // SÉCURITÉ : Empêcher les requêtes qui couvrent plus de 20% de la vidéo (plus permissif pour le streaming)
            if (videoSize > 0) {
              const requestedSize = (end !== null ? end : start + maxChunkSize) - start;
              const percentage = (requestedSize / videoSize) * 100;
              if (percentage > 20) {
                logSuspiciousActivity('LARGE_RANGE_REQUEST', { 
                  userId, 
                  videoId, 
                  percentage: percentage.toFixed(2),
                  requestedSize,
                  videoSize,
                  ip: clientIp
                });
                return res.status(403).json({ error: 'Range request trop large - Accès refusé' });
              }
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
          'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Disposition': 'inline; filename="stream.mp4"', // inline empêche le téléchargement
          'X-Robots-Tag': 'noindex, nofollow', // Empêcher l'indexation
          'Cross-Origin-Resource-Policy': 'same-origin', // Empêcher l'accès cross-origin
          'X-Permitted-Cross-Domain-Policies': 'none', // Empêcher l'accès cross-domain
          'Referrer-Policy': 'same-origin' // Limiter les informations de referrer
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
    
    // ========== ROUTES HLS ==========
    // POST /api/videos/hls/playlist - Générer une playlist HLS avec token
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'hls' && pathParts[3] === 'playlist' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { videoId } = req.body;

      if (!videoId) {
        return res.status(400).json({ error: 'ID de vidéo requis' });
      }

      // Récupérer les infos de la vidéo
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('video_url, title, id')
        .eq('id', videoId)
        .single();

      if (videoError || !video || !video.video_url) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      // Créer une session HLS avec token signé (valide 5 minutes)
      const sessionId = uuidv4();
      const token = jwt.sign(
        {
          userId: user.id,
          videoId: videoId,
          sessionId: sessionId,
          userEmail: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
        },
        JWT_SECRET
      );

      // Stocker la session (utiliser secureStreams pour les sessions HLS aussi)
      secureStreams.set(sessionId, {
        userId: user.id,
        videoId: videoId,
        videoUrl: video.video_url,
        userEmail: user.email,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        token: token,
        type: 'hls'
      });

      console.log('[HLS] Session créée:', sessionId.substring(0, 16) + '...', 'pour videoId:', videoId);

      // Générer la playlist HLS avec watermarking
      const playlistUrl = `${req.protocol || 'https'}://${req.headers.host}/api/videos/hls/playlist.m3u8?token=${encodeURIComponent(token)}`;
      
      return res.json({
        playlistUrl,
        sessionId,
        expiresIn: 300
      });
    }

    // GET /api/videos/hls/playlist.m3u8 - Récupérer la playlist HLS
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'hls' && pathParts[3] === 'playlist.m3u8' && req.method === 'GET') {
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const token = searchParams.get('token');

      if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Vérifier que le token contient les informations nécessaires
        if (!decoded.sessionId || !decoded.userId || !decoded.videoId) {
          console.error('[HLS Playlist] Token incomplet');
          return res.status(401).json({ error: 'Token invalide - informations manquantes' });
        }

        // Récupérer l'URL de la vidéo depuis la base de données (car les sessions ne persistent pas sur serverless)
        const { data: video, error: videoError } = await supabase
          .from('videos')
          .select('video_url, id')
          .eq('id', decoded.videoId)
          .single();

        if (videoError || !video || !video.video_url) {
          console.error('[HLS Playlist] Vidéo non trouvée:', decoded.videoId);
          return res.status(404).json({ error: 'Vidéo non trouvée' });
        }

        // Vérifier le Referer/Origin (assoupli pour les requêtes HLS)
        const referer = req.headers.referer || '';
        const origin = req.headers.origin || '';
        const host = req.headers.host || '';
        const isValidReferer = referer && (referer.includes(host) || referer.includes('yunoa.xyz'));
        const isValidOrigin = origin && (origin.includes(host) || origin.includes('yunoa.xyz'));
        
        // Ne bloquer que si un referer/origin est présent et invalide
        if ((referer || origin) && !isValidReferer && !isValidOrigin) {
          logSuspiciousActivity('INVALID_REFERER_HLS', { 
            userId: decoded.userId, 
            videoId: decoded.videoId,
            referer,
            origin,
            ip: getClientIp(req)
          });
          return res.status(403).json({ error: 'Accès refusé' });
        }

        // Générer la playlist HLS avec segments signés
        const baseUrl = `${req.protocol || 'https'}://${req.headers.host}/api/videos/hls`;
        
        const segmentToken = jwt.sign(
          {
            sessionId: decoded.sessionId,
            userId: decoded.userId,
            videoId: decoded.videoId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300
          },
          JWT_SECRET
        );

        // Obtenir la taille de la vidéo pour générer la playlist
        let videoSize = 0;
        try {
          const headResponse = await fetch(video.video_url, { method: 'HEAD' });
          const contentLength = headResponse.headers.get('content-length');
          videoSize = contentLength ? parseInt(contentLength) : 0;
        } catch (error) {
          console.warn('[HLS] Impossible de récupérer la taille de la vidéo');
        }

        // Générer les segments (10MB par segment, ~10 secondes de vidéo)
        const segmentSize = 10 * 1024 * 1024; // 10MB
        const totalSegments = videoSize > 0 ? Math.ceil(videoSize / segmentSize) : 100; // Par défaut 100 segments

        // Générer la playlist HLS
        let playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
`;

        // Ajouter les segments
        for (let i = 0; i < Math.min(totalSegments, 1000); i++) { // Limiter à 1000 segments max
          playlist += `#EXTINF:10.0,
${baseUrl}/segment.ts?token=${encodeURIComponent(segmentToken)}&index=${i}
`;
        }

        playlist += `#EXT-X-ENDLIST`;

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(playlist);

      } catch (error) {
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    // GET /api/videos/hls/segment.ts - Récupérer un segment avec watermarking
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'hls' && pathParts[3] === 'segment.ts' && req.method === 'GET') {
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const token = searchParams.get('token');
      const segmentIndex = parseInt(searchParams.get('index') || '0');
      
      if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Vérifier que le token contient les informations nécessaires
        if (!decoded.sessionId || !decoded.userId || !decoded.videoId) {
          console.error('[HLS Segment] Token incomplet:', { hasSessionId: !!decoded.sessionId, hasUserId: !!decoded.userId, hasVideoId: !!decoded.videoId });
          return res.status(401).json({ error: 'Token invalide - informations manquantes' });
        }

        // Vérifier le Referer/Origin (assoupli pour les requêtes HLS)
        const referer = req.headers.referer || '';
        const origin = req.headers.origin || '';
        const host = req.headers.host || '';
        const isValidReferer = referer && (referer.includes(host) || referer.includes('yunoa.xyz'));
        const isValidOrigin = origin && (origin.includes(host) || origin.includes('yunoa.xyz'));
        
        // Ne bloquer que si un referer/origin est présent et invalide
        if ((referer || origin) && !isValidReferer && !isValidOrigin) {
          logSuspiciousActivity('INVALID_REFERER_HLS_SEGMENT', { 
            userId: decoded.userId, 
            videoId: decoded.videoId,
            referer,
            origin,
            ip: getClientIp(req)
          });
          return res.status(403).json({ error: 'Accès refusé' });
        }

        // Récupérer l'URL de la vidéo depuis la base de données (car les sessions ne persistent pas sur serverless)
        const { data: video, error: videoError } = await supabase
          .from('videos')
          .select('video_url, id')
          .eq('id', decoded.videoId)
          .single();

        if (videoError || !video || !video.video_url) {
          console.error('[HLS Segment] Vidéo non trouvée:', decoded.videoId);
          return res.status(404).json({ error: 'Vidéo non trouvée' });
        }

        // Récupérer le segment avec watermarking
        const segmentSize = 10 * 1024 * 1024; // 10MB par segment
        const start = segmentIndex * segmentSize;
        const end = start + segmentSize - 1;

        // Faire une requête proxy vers la vidéo avec Range
        const videoResponse = await fetch(video.video_url, {
          headers: {
            'Range': `bytes=${start}-${end}`
          }
        });

        if (!videoResponse.ok && videoResponse.status !== 206) {
          console.error('[HLS Segment] Erreur fetch vidéo:', videoResponse.status);
          return res.status(videoResponse.status).json({ error: 'Erreur de récupération segment' });
        }

        // Headers de sécurité
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        if (videoResponse.status === 206) {
          res.setHeader('Content-Range', videoResponse.headers.get('content-range') || '');
        }

        res.status(videoResponse.status);

        // Streamer le segment
        const buffer = await videoResponse.arrayBuffer();
        return res.end(Buffer.from(buffer));

      } catch (error) {
        console.error('[HLS Segment] Erreur:', error);
        return res.status(401).json({ error: 'Token invalide', details: error.message });
      }
    }

    // ========== ROUTES CUSTOM STREAMING ==========
    // POST /api/videos/stream-metadata - Obtenir les métadonnées pour le streaming custom
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'stream-metadata' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { videoId } = req.body;

      if (!videoId) {
        return res.status(400).json({ error: 'ID de vidéo requis' });
      }

      // Récupérer les infos de la vidéo
        const { data: video, error: videoError } = await supabase
          .from('videos')
        .select('video_url, title, duration, id')
          .eq('id', videoId)
          .single();

      if (videoError || !video || !video.video_url) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      // Convertir la durée de "60min" ou "1h30min" en secondes
      let durationInSeconds = 0;
      if (video.duration) {
        const durationStr = video.duration.toString().toLowerCase();
        // Parser "60min", "1h30min", "1h", "30min", etc.
        const hoursMatch = durationStr.match(/(\d+)h/);
        const minutesMatch = durationStr.match(/(\d+)min/);
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
        durationInSeconds = (hours * 3600) + (minutes * 60);
      }

      // Obtenir la taille de la vidéo
      let totalSize = 0;
      try {
        const headResponse = await fetch(video.video_url, { method: 'HEAD' });
        const contentLength = headResponse.headers.get('content-length');
        totalSize = contentLength ? parseInt(contentLength) : 0;
      } catch (error) {
        console.warn('[CustomStream] Impossible de récupérer la taille de la vidéo');
      }

      // Calculer les chunks (2MB par chunk pour un bon équilibre)
      const chunkSize = 2 * 1024 * 1024; // 2MB
      const totalChunks = totalSize > 0 ? Math.ceil(totalSize / chunkSize) : 100;

      return res.json({
        duration: durationInSeconds,
        totalSize,
        chunkSize,
        totalChunks
      });
    }

    // POST /api/videos/stream-chunk - Récupérer un chunk spécifique
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'stream-chunk' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { videoId, chunkIndex, start, end } = req.body;

      if (!videoId || chunkIndex === undefined || start === undefined || end === undefined) {
        return res.status(400).json({ error: 'Paramètres manquants' });
      }

      // Récupérer l'URL de la vidéo
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('video_url, id')
        .eq('id', videoId)
        .single();

      if (videoError || !video || !video.video_url) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      // SÉCURITÉ : Vérifier l'User-Agent
      const userAgent = req.headers['user-agent'] || '';
      const suspiciousAgents = ['Video DownloadHelper', 'youtube-dl', 'wget', 'curl', 'aria2', 'ffmpeg', 'VLC'];
      if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent.toLowerCase()))) {
        logSuspiciousActivity('SUSPICIOUS_USER_AGENT_CHUNK', { 
                userId: user.id,
                videoId,
          userAgent,
          ip: getClientIp(req)
        });
        return res.status(403).json({ error: 'Accès refusé' });
      }

      // SÉCURITÉ : Vérifier le Referer/Origin
      const referer = req.headers.referer || '';
      const origin = req.headers.origin || '';
      const host = req.headers.host || '';
      const isValidReferer = referer && (referer.includes(host) || referer.includes('yunoa.xyz'));
      const isValidOrigin = origin && (origin.includes(host) || origin.includes('yunoa.xyz'));
      
      if ((referer || origin) && !isValidReferer && !isValidOrigin) {
        return res.status(403).json({ error: 'Accès refusé' });
      }

      // SÉCURITÉ : Limiter la taille des chunks (max 5MB)
      const chunkSize = end - start + 1;
      if (chunkSize > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Chunk trop grand' });
      }

      try {
        // Faire une requête Range vers la vidéo
        const videoResponse = await fetch(video.video_url, {
            headers: {
              'Range': `bytes=${start}-${end}`
            }
          });

        if (!videoResponse.ok && videoResponse.status !== 206) {
          return res.status(videoResponse.status).json({ error: 'Erreur de récupération chunk' });
        }

        // Headers de sécurité
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline; filename="chunk.mp4"');
        
        if (videoResponse.status === 206) {
          res.setHeader('Content-Range', videoResponse.headers.get('content-range') || '');
        }

        res.status(videoResponse.status);

        // Streamer le chunk
        const buffer = await videoResponse.arrayBuffer();
        return res.end(Buffer.from(buffer));

      } catch (error) {
        console.error('[CustomStream] Erreur chunk:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
    }

    // ========== ROUTES EPISODES ==========
    // GET /api/videos/episodes?seriesId=xxx → récupérer tous les épisodes d'une série
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'episodes' && req.method === 'GET') {
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const seriesId = searchParams.get('seriesId');
      const id = searchParams.get('id');

      if (seriesId) {
        const [rows] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE "seriesId" = $1 ORDER BY "seasonNumber", "episodeNumber"', [seriesId]);
        return res.json(rows);
      }

      if (id) {
        const [rows] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE uuid = $1', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Épisode introuvable' });
        return res.json(rows[0]);
      }

      return res.status(400).json({ error: 'seriesId ou id requis' });
    }

    // POST /api/videos/episodes → créer un épisode
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'episodes' && req.method === 'POST') {
      const user = authenticateToken(req);
      requireAdmin(user);
      const { seriesId, episodeNumber, seasonNumber, title, description, thumbnail, videoUrl, duration } = req.body;

      if (!title || !videoUrl || !episodeNumber || !seriesId) {
        return res.status(400).json({ error: 'Champs requis manquants' });
      }

      // Vérifier si un épisode avec le même numéro existe déjà
      const [existingEpisodes] = await executeQuery(
        'SELECT uuid FROM episodes WHERE "seriesId" = $1 AND "seasonNumber" = $2 AND "episodeNumber" = $3', 
        [seriesId, seasonNumber || 1, episodeNumber]
      );
      
      if (existingEpisodes.length > 0) {
        return res.status(409).json({ 
          error: `Un épisode ${episodeNumber} existe déjà dans la saison ${seasonNumber || 1}.`,
          code: 'EPISODE_EXISTS'
        });
      }

      const newId = uuidv4();
      await executeQuery(
        'INSERT INTO episodes (uuid, "seriesId", "episodeNumber", "seasonNumber", title, description, thumbnail, "videoUrl", duration, views, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [newId, seriesId, episodeNumber, seasonNumber || 1, title, description, thumbnail, videoUrl, duration, 0, new Date(), new Date()]
      );

      const [episode] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE uuid = $1', [newId]);
      return res.json(episode[0]);
    }

    // PUT /api/videos/episodes?id=xxx → modifier un épisode
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'episodes' && req.method === 'PUT') {
      const user = authenticateToken(req);
      requireAdmin(user);
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const id = searchParams.get('id');

      if (!id) {
        return res.status(400).json({ error: 'ID requis' });
      }

      const { episodeNumber, seasonNumber, title, description, thumbnail, videoUrl, duration } = req.body;
      const [result] = await executeQuery(
        'UPDATE episodes SET "episodeNumber" = $1, "seasonNumber" = $2, title = $3, description = $4, thumbnail = $5, "videoUrl" = $6, duration = $7, "updatedAt" = $8 WHERE uuid = $9',
        [episodeNumber, seasonNumber || 1, title, description, thumbnail, videoUrl, duration, new Date(), id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Épisode non trouvé' });

      const [updated] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE uuid = $1', [id]);
      return res.json(updated[0]);
    }

    // DELETE /api/videos/episodes?id=xxx → supprimer un épisode
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'episodes' && req.method === 'DELETE') {
      const user = authenticateToken(req);
      requireAdmin(user);
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const id = searchParams.get('id');

      if (!id) {
        return res.status(400).json({ error: 'ID requis' });
      }

      const [result] = await executeQuery('DELETE FROM episodes WHERE uuid = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Épisode non trouvé' });

      return res.json({ message: 'Épisode supprimé avec succès' });
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