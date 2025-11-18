
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, handleDbError } from './_lib/db.js';
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
    // GET /api/favorites/{userId}
    if (pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'favorites' && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[2];

      const [favorites] = await executeQuery(`
        SELECT f.uuid as id, f."video_id", f."user_id", f."added_at", v.title, v.thumbnail, v.category, v.year, v."average_rating"
        FROM favorites f
        JOIN videos v ON f."video_id" = v.uuid
        WHERE f."user_id" = $1
        ORDER BY f."added_at" DESC
      `, [userId]);
      
      res.json(favorites);
    }
    // POST /api/favorites
    else if (pathParts.length === 2 && pathParts[0] === 'api' && pathParts[1] === 'favorites' && req.method === 'POST') {
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
      
      res.json({ success: true });
    }
    // DELETE /api/favorites/{userId}/{videoId}
    else if (pathParts.length === 4 && pathParts[0] === 'api' && pathParts[1] === 'favorites' && req.method === 'DELETE') {
      const user = authenticateToken(req);
      const userId = pathParts[2];
      const videoId = pathParts[3];

      await executeQuery(
        'DELETE FROM favorites WHERE "user_id" = $1 AND "video_id" = $2',
        [userId, videoId]
      );
      res.json({ success: true });
    }
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('Favorites error:', error);
    const errorResponse = handleDbError(error, 'gestion des favoris');
    res.status(500).json(errorResponse);
  }
};
