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
  const pathParts = pathname.split('/').filter(part => part); // Remove empty parts

  try {
    // GET /api/ratings/{userId}/{videoId}
    if (pathParts.length >= 4 && pathParts[0] === 'api' && pathParts[1] === 'ratings' && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[2];
      const videoId = pathParts[3];

      try {
        const [ratings] = await executeQuery(
          'SELECT rating FROM ratings WHERE "user_id" = $1 AND "video_id" = $2',
          [userId, videoId]
        );
        
        res.json({ rating: ratings.length > 0 ? ratings[0].rating : null });
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          const fallbackResponse = getFallbackResponse('ratings', dbError);
          return res.status(200).json({ rating: null });
        }
        throw dbError;
      }
    }
    // POST /api/ratings
    else if (pathParts.length === 2 && pathParts[0] === 'api' && pathParts[1] === 'ratings' && req.method === 'POST') {
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
        
        res.json({ success: true });
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          const fallbackResponse = getFallbackResponse('ratings', dbError);
          return res.status(200).json({ success: true });
        }
        throw dbError;
      }
    }
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('Ratings error:', error);
    const errorResponse = handleDbError(error, 'gestion des notes');
    res.status(500).json(errorResponse);
  }
};