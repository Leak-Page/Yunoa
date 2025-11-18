
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, handleDbError } from './_lib/db.js';
import { getFallbackResponse, shouldUseFallback } from './_lib/fallback.js';
import { authenticateToken, corsHeaders } from './_lib/auth.js';

export default async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = pathname.split('/');

  try {
    // Watch history endpoints
    if (pathname.match(/^\/api\/watch-history\/[^/]+$/) && req.method === 'GET') {
      try {
        const user = authenticateToken(req);
        const userId = pathParts[3];
        
        if (user.id !== userId && user.role !== 'admin') {
          return res.status(403).json({ error: 'Accès non autorisé' });
        }
      } catch (authError) {
        return res.status(401).json({ error: 'Token d\'authentification invalide' });
      }

      try {
        const [history] = await executeQuery(`
          SELECT h.uuid as id, h.video_id, h.user_id, h.progress, h.watched_at, v.title, v.thumbnail, v.duration 
          FROM watch_history h 
          LEFT JOIN videos v ON h.video_id = v.uuid 
          WHERE h.user_id = ? 
          ORDER BY h.watched_at DESC 
          LIMIT 50
        `, [userId]);
        
        res.json(history);
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          return res.status(200).json([]);
        }
        throw dbError;
      }
    }
    else if (pathname === '/api/watch-history' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { user_id, video_id, progress } = req.body;
      
      if (user.id !== user_id && user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const historyId = uuidv4();
      
      try {
        // Delete existing entry if exists
        await executeQuery(
          'DELETE FROM watch_history WHERE user_id = ? AND video_id = ?',
          [user_id, video_id]
        );
        
        // Insert new entry
        await executeQuery(`
          INSERT INTO watch_history (uuid, user_id, video_id, progress, watched_at) 
          VALUES (?, ?, ?, ?, ?)
        `, [historyId, user_id, video_id, progress, new Date()]);
        
        res.json({ success: true });
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          return res.json({ success: true });
        }
        throw dbError;
      }
    }
    // Regular history endpoints
    else if (pathname.match(/^\/api\/history\/[^/]+$/) && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[3];

      const [history] = await executeQuery(`
        SELECT wt.*, v.title, v.thumbnail, v.category, v.duration
        FROM watch_time wt
        JOIN videos v ON wt.videoId = v.uuid
        WHERE wt.userId = ?
        ORDER BY wt.lastWatched DESC
        LIMIT 50
      `, [userId]);
      
      res.json(history);
    }
    else if (pathname === '/api/history' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { userId, videoId, progress } = req.body;
      const watchId = uuidv4();
      
      await executeQuery(`
        INSERT INTO watch_time (id, userId, videoId, progress, lastWatched) 
        VALUES (?, ?, ?, ?, ?) 
        ON DUPLICATE KEY UPDATE 
          progress = VALUES(progress), 
          lastWatched = VALUES(lastWatched)
      `, [watchId, userId, videoId, progress, new Date()]);
      
      res.json({ success: true });
    }
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('History error:', error);
    const errorResponse = handleDbError(error, 'gestion de l\'historique');
    res.status(500).json(errorResponse);
  }
};
