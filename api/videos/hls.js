/**
 * API HLS pour le streaming sécurisé
 * Architecture: MP4 → HLS → API → token → playlist → segments
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, JWT_SECRET } from '../_lib/auth.js';
import { getClientIp, logSuspiciousActivity } from '../_lib/security.js';
import { corsHeaders } from '../_lib/auth.js';

const supabase = createClient(
  'https://efeommwlobsenrvqedcj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZW9tbXdsb2JzZW5ydnFlZGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDUwNTcsImV4cCI6MjA2OTYyMTA1N30.4Cl5_lJqCVI02Q-V47Ab7KhZ4jjnt7LkpysiYGNMW0c'
);

// Stockage des sessions HLS
const hlsSessions = new Map();

// Nettoyage automatique des sessions expirées
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of hlsSessions.entries()) {
    if (now > session.expiresAt) {
      hlsSessions.delete(sessionId);
    }
  }
}, 60 * 1000);

/**
 * Génère une playlist HLS avec watermarking
 */
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
    // POST /api/videos/hls/playlist - Générer une playlist HLS avec token
    if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'videos' && pathParts[2] === 'hls' && pathParts[3] === 'playlist' && req.method === 'POST') {
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

      // Stocker la session
      hlsSessions.set(sessionId, {
        userId: user.id,
        videoId: videoId,
        videoUrl: video.video_url,
        userEmail: user.email,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        token: token
      });

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
        const session = hlsSessions.get(decoded.sessionId);

        if (!session || Date.now() > session.expiresAt) {
          return res.status(401).json({ error: 'Session expirée' });
        }

        // Vérifier le Referer/Origin
        const referer = req.headers.referer || '';
        const origin = req.headers.origin || '';
        const host = req.headers.host || '';
        const isValidReferer = referer && (referer.includes(host) || referer.includes('yunoa.xyz'));
        const isValidOrigin = origin && (origin.includes(host) || origin.includes('yunoa.xyz'));
        
        if ((referer || origin) && !isValidReferer && !isValidOrigin) {
          logSuspiciousActivity('INVALID_REFERER_HLS', { 
            userId: session.userId, 
            videoId: session.videoId,
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
            userId: session.userId,
            videoId: session.videoId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300
          },
          JWT_SECRET
        );

        // Obtenir la taille de la vidéo pour générer la playlist
        let videoSize = 0;
        try {
          const headResponse = await fetch(session.videoUrl, { method: 'HEAD' });
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
        const session = hlsSessions.get(decoded.sessionId);

        if (!session || Date.now() > session.expiresAt) {
          return res.status(401).json({ error: 'Session expirée' });
        }

        // Vérifier le Referer/Origin
        const referer = req.headers.referer || '';
        const origin = req.headers.origin || '';
        const host = req.headers.host || '';
        const isValidReferer = referer && (referer.includes(host) || referer.includes('yunoa.xyz'));
        const isValidOrigin = origin && (origin.includes(host) || origin.includes('yunoa.xyz'));
        
        if ((referer || origin) && !isValidReferer && !isValidOrigin) {
          return res.status(403).json({ error: 'Accès refusé' });
        }

        // Récupérer le segment avec watermarking
        // Pour l'instant, on utilise le système de streaming existant avec Range requests
        // TODO: Implémenter la conversion MP4 → HLS avec watermarking dynamique
        
        const segmentSize = 10 * 1024 * 1024; // 10MB par segment
        const start = segmentIndex * segmentSize;
        const end = start + segmentSize - 1;

        // Faire une requête proxy vers la vidéo avec Range
        const videoResponse = await fetch(session.videoUrl, {
          headers: {
            'Range': `bytes=${start}-${end}`
          }
        });

        if (!videoResponse.ok && videoResponse.status !== 206) {
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
        return res.status(401).json({ error: 'Token invalide' });
      }
    }

    return res.status(404).json({ error: 'Endpoint non trouvé' });

  } catch (error) {
    console.error('[HLS API] Erreur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};


