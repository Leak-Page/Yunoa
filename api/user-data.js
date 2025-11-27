/**
 * API consolidée pour les données utilisateur
 * Combine: favorites, history, ratings
 */

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
  const pathParts = pathname.split('/').filter(part => part);

  try {
    // ========== ROUTES FAVORITES ==========
    // GET /api/user-data/favorites/{userId}
    if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'user-data' && pathParts[2] === 'favorites' && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[3];

      if (!userId) {
        return res.status(400).json({ error: 'userId requis' });
      }

      const [favorites] = await executeQuery(`
        SELECT f.uuid as id, f."video_id", f."user_id", f."added_at", v.title, v.thumbnail, v.category, v.year, v."average_rating"
        FROM favorites f
        JOIN videos v ON f."video_id" = v.uuid
        WHERE f."user_id" = $1
        ORDER BY f."added_at" DESC
      `, [userId]);
      
      return res.json(favorites);
    }

    // POST /api/user-data/favorites
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'user-data' && pathParts[2] === 'favorites' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { user_id, video_id } = req.body;
      
      const [existing] = await executeQuery(
        'SELECT uuid FROM favorites WHERE "user_id" = $1 AND "video_id" = $2',
        [user_id, video_id]
      );
      
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Déjà dans les favoris' });
      }
      
      const favoriteId = uuidv4();
      await executeQuery(
        'INSERT INTO favorites (uuid, "user_id", "video_id", "added_at") VALUES ($1, $2, $3, $4)',
        [favoriteId, user_id, video_id, new Date()]
      );
      
      return res.json({ success: true });
    }

    // DELETE /api/user-data/favorites/{userId}/{videoId}
    else if (pathParts.length === 5 && pathParts[0] === 'api' && pathParts[1] === 'user-data' && pathParts[2] === 'favorites' && req.method === 'DELETE') {
      const user = authenticateToken(req);
      const userId = pathParts[3];
      const videoId = pathParts[4];

      await executeQuery(
        'DELETE FROM favorites WHERE "user_id" = $1 AND "video_id" = $2',
        [userId, videoId]
      );
      return res.json({ success: true });
    }

    // ========== ROUTES HISTORY ==========
    // GET /api/user-data/history/{userId}
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'user-data' && pathParts[2] === 'history' && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[3];
      
      if (user.id !== userId && user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      try {
        const [history] = await executeQuery(`
          SELECT h.uuid as id, h.video_id, h.user_id, h.progress, h.watched_at, v.title, v.thumbnail, v.duration 
          FROM watch_history h 
          LEFT JOIN videos v ON h.video_id = v.uuid 
          WHERE h.user_id = $1 
          ORDER BY h.watched_at DESC 
          LIMIT 50
        `, [userId]);
        
        return res.json(history);
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          return res.status(200).json([]);
        }
        throw dbError;
      }
    }

    // POST /api/user-data/history
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'user-data' && pathParts[2] === 'history' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { user_id, video_id, progress } = req.body;
      
      if (user.id !== user_id && user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }

      const historyId = uuidv4();
      
      try {
        // Delete existing entry if exists
        await executeQuery(
          'DELETE FROM watch_history WHERE user_id = $1 AND video_id = $2',
          [user_id, video_id]
        );
        
        // Insert new entry
        await executeQuery(`
          INSERT INTO watch_history (uuid, user_id, video_id, progress, watched_at) 
          VALUES ($1, $2, $3, $4, $5)
        `, [historyId, user_id, video_id, progress, new Date()]);
        
        return res.json({ success: true });
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          return res.json({ success: true });
        }
        throw dbError;
      }
    }

    // ========== ROUTES RATINGS ==========
    // GET /api/user-data/ratings/{userId}/{videoId}
    else if (pathParts.length === 5 && pathParts[0] === 'api' && pathParts[1] === 'user-data' && pathParts[2] === 'ratings' && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[3];
      const videoId = pathParts[4];

      try {
        const [ratings] = await executeQuery(
          'SELECT rating FROM ratings WHERE "user_id" = $1 AND "video_id" = $2',
          [userId, videoId]
        );
        
        return res.json({ rating: ratings.length > 0 ? ratings[0].rating : null });
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          return res.status(200).json({ rating: null });
        }
        throw dbError;
      }
    }

    // POST /api/user-data/ratings
    else if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'user-data' && pathParts[2] === 'ratings' && req.method === 'POST') {
      const user = authenticateToken(req);
      const { user_id, video_id, rating } = req.body;
      const ratingId = uuidv4();
      
      try {
        // Check if rating exists first
        const [existingRating] = await executeQuery(
          'SELECT uuid FROM ratings WHERE "user_id" = $1 AND "video_id" = $2',
          [user_id, video_id]
        );

        if (existingRating.length > 0) {
          // Update existing rating
          await executeQuery(
            'UPDATE ratings SET rating = $1, "updated_at" = $2 WHERE "user_id" = $3 AND "video_id" = $4',
            [rating, new Date(), user_id, video_id]
          );
        } else {
          // Insert new rating
          await executeQuery(
            'INSERT INTO ratings (uuid, "user_id", "video_id", rating, "created_at", "updated_at") VALUES ($1, $2, $3, $4, $5, $6)',
            [ratingId, user_id, video_id, rating, new Date(), new Date()]
          );
        }
        
        const [avgResult] = await executeQuery(
          'SELECT AVG(rating) as "avgRating", COUNT(*) as "totalRatings" FROM ratings WHERE "video_id" = $1',
          [video_id]
        );
        
        await executeQuery(
          'UPDATE videos SET "average_rating" = $1, "total_ratings" = $2 WHERE uuid = $3',
          [parseFloat(avgResult[0].avgRating || 0), avgResult[0].totalRatings, video_id]
        );
        
        return res.json({ success: true });
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          return res.status(200).json({ success: true });
        }
        throw dbError;
      }
    }

    else {
      return res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('User-data API error:', error);
    const errorResponse = handleDbError(error, 'gestion des données utilisateur');
    return res.status(500).json(errorResponse);
  }
};

