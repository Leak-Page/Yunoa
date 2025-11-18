import { executeQuery, handleDbError } from './db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'streamflix-secret-key-2024';
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1398578324636176466/Bk_mv7IKNbcMx96OpCc_SpTAPaKlhZelG2orwec-A1oOtQE1wcCDawXkWa2_WUATme7N';

// Stockage temporaire des tentatives (en production, utiliser Redis/DB)
const loginAttempts = new Map();
const ipBlacklist = new Map();
const videoSessions = new Map();

// DRM Protection Storage
const drmKeys = new Map(); // Stockage des clés de déchiffrement HLS
const activeSessions = new Map(); // Sessions actives pour limitation simultanée
const accessLogs = new Map(); // Logs d'accès pour détection d'abus
const keyRotations = new Map(); // Historique des rotations de clés

// Nettoyage automatique toutes les 10 minutes
setInterval(() => {
  const now = Date.now();
  // Nettoyer les tentatives expirées
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.unlockedAt) {
      loginAttempts.delete(key);
    }
  }
  // Nettoyer les IPs bloquées expirées
  for (const [ip, data] of ipBlacklist.entries()) {
    if (now > data.unlockedAt) {
      ipBlacklist.delete(ip);
    }
  }
  // Nettoyer les sessions vidéo expirées
  for (const [token, data] of videoSessions.entries()) {
    if (now > data.expiresAt) {
      videoSessions.delete(token);
    }
  }
  
  // Nettoyer les clés DRM expirées
  for (const [keyId, data] of drmKeys.entries()) {
    if (now > data.expiresAt) {
      drmKeys.delete(keyId);
    }
  }
  
  // Nettoyer les sessions actives expirées
  for (const [sessionId, data] of activeSessions.entries()) {
    if (now > data.expiresAt) {
      activeSessions.delete(sessionId);
    }
  }
  
  // Nettoyer les anciens logs d'accès (garder 24h)
  for (const [key, logs] of accessLogs.entries()) {
    const filteredLogs = logs.filter(log => now - log.timestamp < 24 * 60 * 60 * 1000);
    if (filteredLogs.length === 0) {
      accessLogs.delete(key);
    } else {
      accessLogs.set(key, filteredLogs);
    }
  }
}, 10 * 60 * 1000);

// Protection brute-force utilisateur
function checkUserLimits(username) {
  const key = `user_${username}`;
  const attempts = loginAttempts.get(key);
  
  if (!attempts) return { allowed: true };
  
  const now = Date.now();
  
  // Si l'utilisateur est encore bloqué
  if (attempts.count >= 5 && now < attempts.unlockedAt) {
    const remainingTime = Math.ceil((attempts.unlockedAt - now) / 1000 / 60);
    return { 
      allowed: false, 
      message: `Trop de tentatives. Réessayez dans ${remainingTime} minute(s).`,
      remainingTime
    };
  }
  
  // Réinitialiser si le temps de blocage est passé
  if (now >= attempts.unlockedAt) {
    loginAttempts.delete(key);
    return { allowed: true };
  }
  
  return { allowed: true };
}

// Protection brute-force IP
function checkIpLimits(ip) {
  const blocked = ipBlacklist.get(ip);
  
  if (!blocked) return { allowed: true };
  
  const now = Date.now();
  
  if (blocked.count >= 10 && now < blocked.unlockedAt) {
    const remainingTime = Math.ceil((blocked.unlockedAt - now) / 1000 / 60);
    return { 
      allowed: false, 
      message: `IP temporairement bloquée. Réessayez dans ${remainingTime} minute(s).`,
      remainingTime
    };
  }
  
  // Réinitialiser si le temps de blocage est passé
  if (now >= blocked.unlockedAt) {
    ipBlacklist.delete(ip);
    return { allowed: true };
  }
  
  return { allowed: true };
}

// Enregistrer une tentative échouée
function recordFailedAttempt(username, ip) {
  const now = Date.now();
  const userKey = `user_${username}`;
  
  // Enregistrer pour l'utilisateur
  const userAttempts = loginAttempts.get(userKey) || { count: 0, firstAttempt: now };
  userAttempts.count++;
  userAttempts.lastAttempt = now;
  
  // Bloquer après 5 tentatives pour 5 minutes
  if (userAttempts.count >= 5) {
    userAttempts.unlockedAt = now + (5 * 60 * 1000); // 5 minutes
  }
  
  loginAttempts.set(userKey, userAttempts);
  
  // Enregistrer pour l'IP
  const ipAttempts = ipBlacklist.get(ip) || { count: 0, firstAttempt: now };
  ipAttempts.count++;
  ipAttempts.lastAttempt = now;
  
  // Bloquer après 10 tentatives pour 15 minutes
  if (ipAttempts.count >= 10) {
    ipAttempts.unlockedAt = now + (15 * 60 * 1000); // 15 minutes
  }
  
  ipBlacklist.set(ip, ipAttempts);
}

// Réinitialiser les tentatives après succès
function resetAttempts(username, ip) {
  const userKey = `user_${username}`;
  loginAttempts.delete(userKey);
  
  // Réduire le compteur IP mais ne pas le supprimer complètement
  const ipAttempts = ipBlacklist.get(ip);
  if (ipAttempts && ipAttempts.count > 0) {
    ipAttempts.count = Math.max(0, ipAttempts.count - 1);
    if (ipAttempts.count === 0) {
      ipBlacklist.delete(ip);
    } else {
      ipBlacklist.set(ip, ipAttempts);
    }
  }
}

// Générer un token de session vidéo
function generateVideoSessionToken(userId, videoId) {
  const sessionId = Math.random().toString(36).substring(2);
  const timestamp = Date.now();
  
  const token = jwt.sign(
    { 
      userId, 
      videoId, 
      sessionId,
      timestamp
    },
    JWT_SECRET,
    { expiresIn: '4h' }
  );
  
  // Stocker la session (optionnel pour debug)
  const expiresAt = Date.now() + (4 * 60 * 60 * 1000); // 4 heures
  videoSessions.set(token, { userId, videoId, sessionId, expiresAt });
  
  console.log('🔑 Token de session vidéo généré:', { userId, videoId, sessionId });
  return token;
}

// Valider un token de session vidéo
function validateVideoSessionToken(token, videoId) {
  try {
    // Décoder et vérifier le JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded.userId || !decoded.videoId) {
      console.error('Token JWT manque userId ou videoId:', { hasUserId: !!decoded.userId, hasVideoId: !!decoded.videoId });
      return { valid: false, reason: 'Token incomplet' };
    }
    
    if (decoded.videoId !== videoId) {
      console.error('VideoId mismatch:', { tokenVideoId: decoded.videoId, expectedVideoId: videoId });
      return { valid: false, reason: 'VideoId ne correspond pas' };
    }
    
    // Le JWT est valide et correspond, pas besoin de vérifier la session en mémoire
    // car le JWT contient déjà toutes les informations nécessaires
    console.log('✅ Token de session vidéo validé avec succès');
    return { valid: true, userId: decoded.userId };
    
  } catch (error) {
    console.error('Erreur validation token:', error.message);
    return { valid: false, reason: `Token invalide: ${error.message}` };
  }
}

// Détection VPN basique (liste d'IP ranges connus)
const VPN_IP_RANGES = [
  // Quelques ranges VPN connus (à étendre selon les besoins)
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  // Ajouter d'autres ranges selon les besoins
];

function isVpnIp(ip) {
  // Vérification basique - en production, utiliser un service comme MaxMind
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return false; // IP locale, pas VPN
  }
  
  // Ici on pourrait intégrer un service de détection VPN
  // Pour l'instant, retourne false (pas de détection VPN active)
  return false;
}

// Protection contre JavaScript injection
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/eval\(/gi, '')
    .replace(/Function\(/gi, '')
    .trim();
}

// Protection contre Tampermonkey/extensions
function generateCsrfToken() {
  return jwt.sign(
    { 
      csrf: true, 
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2)
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function validateCsrfToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.csrf === true;
  } catch {
    return false;
  }
}

// Obtenir l'IP réelle du client
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         '127.0.0.1';
}

// ============= DRM PROTECTION SYSTEM =============

// Générer une clé AES-128 pour HLS
function generateHLSKey() {
  return crypto.randomBytes(16); // 128-bit key
}

// Générer un ID unique pour une clé
function generateKeyId() {
  return crypto.randomBytes(8).toString('hex');
}

// Créer et stocker une nouvelle clé DRM
function createDRMKey(videoId, userId, segmentNumber = 0) {
  const keyId = generateKeyId();
  const key = generateHLSKey();
  const now = Date.now();
  const expiresAt = now + (15 * 60 * 1000); // 15 minutes d'expiration
  
  const keyData = {
    keyId,
    key,
    videoId,
    userId,
    segmentNumber,
    createdAt: now,
    expiresAt,
    accessCount: 0
  };
  
  drmKeys.set(keyId, keyData);
  
  // Enregistrer la rotation
  const rotationKey = `${videoId}_${segmentNumber}`;
  if (!keyRotations.has(rotationKey)) {
    keyRotations.set(rotationKey, []);
  }
  keyRotations.get(rotationKey).push(keyData);
  
  return { keyId, key: key.toString('hex') };
}

// Valider et récupérer une clé DRM
function getDRMKey(keyId, token, req) {
  const keyData = drmKeys.get(keyId);
  
  if (!keyData) {
    logSuspiciousActivity('KEY_NOT_FOUND', { keyId, ip: getClientIp(req) });
    return null;
  }
  
  if (Date.now() > keyData.expiresAt) {
    drmKeys.delete(keyId);
    logSuspiciousActivity('KEY_EXPIRED', { keyId, ip: getClientIp(req) });
    return null;
  }
  
  // Vérifier le token JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.userId !== keyData.userId) {
      logSuspiciousActivity('USER_MISMATCH', { 
        keyId, 
        tokenUserId: decoded.userId, 
        keyUserId: keyData.userId,
        ip: getClientIp(req)
      });
      return null;
    }
  } catch (error) {
    logSuspiciousActivity('INVALID_TOKEN', { keyId, error: error.message, ip: getClientIp(req) });
    return null;
  }
  
  // Incrémenter le compteur d'accès
  keyData.accessCount++;
  
  // Détecter les accès suspects (trop fréquents)
  if (keyData.accessCount > 10) {
    logSuspiciousActivity('EXCESSIVE_KEY_ACCESS', { 
      keyId, 
      accessCount: keyData.accessCount,
      ip: getClientIp(req)
    });
  }
  
  // Logger l'accès normal
  logAccess(keyData.userId, keyData.videoId, getClientIp(req), req.headers['user-agent']);
  
  return keyData.key;
}

// Système de limitation des flux simultanés
function checkConcurrentStreams(userId, videoId, maxStreams = 3) {
  const userSessions = Array.from(activeSessions.values())
    .filter(session => session.userId === userId && Date.now() < session.expiresAt);
  
  if (userSessions.length >= maxStreams) {
    return {
      allowed: false,
      message: `Nombre maximum de flux simultanés atteint (${maxStreams})`,
      activeSessions: userSessions.length
    };
  }
  
  return { allowed: true };
}

// Créer une session de streaming
function createStreamingSession(userId, videoId, req) {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + (4 * 60 * 60 * 1000); // 4 heures
  
  const session = {
    sessionId,
    userId,
    videoId,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    createdAt: now,
    expiresAt,
    lastActivity: now
  };
  
  activeSessions.set(sessionId, session);
  return sessionId;
}

// Logger les accès pour surveillance
function logAccess(userId, videoId, ip, userAgent) {
  const key = `${userId}_${videoId}`;
  if (!accessLogs.has(key)) {
    accessLogs.set(key, []);
  }
  
  const logs = accessLogs.get(key);
  logs.push({
    timestamp: Date.now(),
    ip,
    userAgent,
    action: 'KEY_ACCESS'
  });
  
  // Garder seulement les 100 derniers accès
  if (logs.length > 100) {
    logs.splice(0, logs.length - 100);
  }
}

// Détecter et logger les activités suspectes
function logSuspiciousActivity(type, data) {
  console.error(`🚨 SUSPICIOUS ACTIVITY: ${type}`, data);
  
  // Envoyer une alerte Discord
  sendDiscordAlert(type, data).catch(console.error);
}

// Détecter les patterns d'abus
function detectAbusePatterns(userId, videoId) {
  const key = `${userId}_${videoId}`;
  const logs = accessLogs.get(key) || [];
  const now = Date.now();
  const lastHour = logs.filter(log => now - log.timestamp < 60 * 60 * 1000);
  
  // Détection d'accès trop fréquents (plus de 50 requêtes/heure)
  if (lastHour.length > 50) {
    return {
      isAbuse: true,
      reason: 'EXCESSIVE_REQUESTS',
      count: lastHour.length
    };
  }
  
  // Détection de multiples IPs (plus de 3 IPs différentes en 1h)
  const uniqueIPs = new Set(lastHour.map(log => log.ip));
  if (uniqueIPs.size > 3) {
    return {
      isAbuse: true,
      reason: 'MULTIPLE_IPS',
      ips: Array.from(uniqueIPs)
    };
  }
  
  // Détection de multiples User-Agents suspects
  const uniqueUAs = new Set(lastHour.map(log => log.userAgent));
  const suspiciousUAs = Array.from(uniqueUAs).filter(ua => 
    !ua.includes('Chrome') && !ua.includes('Firefox') && !ua.includes('Safari') && !ua.includes('YunoaApp')
  );
  
  if (suspiciousUAs.length > 0) {
    return {
      isAbuse: true,
      reason: 'SUSPICIOUS_USER_AGENT',
      userAgents: suspiciousUAs
    };
  }
  
  return { isAbuse: false };
}

// Envoyer une alerte Discord
async function sendDiscordAlert(type, data) {
  const embed = {
    title: '🚨 Security Alert - DRM Protection',
    color: 0xff0000,
    timestamp: new Date().toISOString(),
    fields: [
      {
        name: 'Type d\'alerte',
        value: type,
        inline: true
      },
      {
        name: 'Détails',
        value: JSON.stringify(data, null, 2).substring(0, 1000),
        inline: false
      }
    ]
  };
  
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (error) {
    console.error('Failed to send Discord alert:', error);
  }
}

// Générer les commandes FFmpeg pour conversion HLS chiffré
function generateFFmpegCommands(inputVideo, outputDir) {
  const keyFile = `${outputDir}/key.bin`;
  const keyInfoFile = `${outputDir}/keyinfo.txt`;
  
  // Générer une clé AES-128
  const key = generateHLSKey();
  
  return {
    key: key.toString('hex'),
    commands: [
      // Créer le fichier de clé
      `echo "${key.toString('hex')}" | xxd -r -p > ${keyFile}`,
      
      // Créer le fichier keyinfo
      `echo "key.bin" > ${keyInfoFile}`,
      `echo "${keyFile}" >> ${keyInfoFile}`,
      `echo "${key.toString('hex')}" >> ${keyInfoFile}`,
      
      // Conversion FFmpeg avec chiffrement
      `ffmpeg -i "${inputVideo}" \\
        -c:v libx264 -c:a aac \\
        -hls_time 2 \\
        -hls_key_info_file "${keyInfoFile}" \\
        -hls_playlist_type vod \\
        -hls_segment_filename "${outputDir}/segment_%03d.ts" \\
        "${outputDir}/playlist.m3u8"`
    ]
  };
}

export {
  checkUserLimits,
  checkIpLimits,
  recordFailedAttempt,
  resetAttempts,
  generateVideoSessionToken,
  validateVideoSessionToken,
  isVpnIp,
  sanitizeInput,
  generateCsrfToken,
  validateCsrfToken,
  getClientIp,
  // DRM Functions
  createDRMKey,
  getDRMKey,
  checkConcurrentStreams,
  createStreamingSession,
  detectAbusePatterns,
  logSuspiciousActivity,
  generateFFmpegCommands
};