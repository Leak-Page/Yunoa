
import { executeQuery, handleDbError } from './_lib/db.js';
import { getFallbackResponse, shouldUseFallback } from './_lib/fallback.js';
import { authenticateToken, requireAdmin, corsHeaders } from './_lib/auth.js';

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
    if (pathname === '/api/users' && req.method === 'GET') {
      const user = authenticateToken(req);
      requireAdmin(user);

      try {
        const [users] = await executeQuery(`
          SELECT 
            p.id, p.username, u.email, p.role, p.created_at,
            COUNT(DISTINCT f.uuid) as "totalFavorites",
            COUNT(DISTINCT wh.id) as "totalWatched"
          FROM profiles p
          JOIN auth.users u ON p.id = u.id
          LEFT JOIN favorites f ON p.id = f."user_id"
          LEFT JOIN watch_history wh ON p.id = wh."user_id"
          GROUP BY p.id, p.username, u.email, p.role, p.created_at
          ORDER BY p.created_at DESC
        `);
        res.json(users);
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          const fallbackResponse = getFallbackResponse('users', dbError);
          return res.status(200).json(fallbackResponse.data);
        }
        throw dbError;
      }
    }
    else if (pathname.match(/^\/api\/users\/[^/]+$/) && req.method === 'PUT') {
      const user = authenticateToken(req);
      requireAdmin(user);
      const userId = pathParts[3];

      const { username, email, role } = req.body;
      
      await executeQuery(
        'UPDATE profiles SET username = $1, role = $2 WHERE id = $3',
        [username, role, userId]
      );
      
      const [updatedUser] = await executeQuery(
        'SELECT p.id, p.username, u.email, p.role, p.created_at FROM profiles p JOIN auth.users u ON p.id = u.id WHERE p.id = $1',
        [userId]
      );
      
      res.json(updatedUser[0]);
    }
    else if (pathname.match(/^\/api\/users\/[^/]+$/) && req.method === 'DELETE') {
      const user = authenticateToken(req);
      requireAdmin(user);
      const userId = pathParts[3];

      await executeQuery('DELETE FROM profiles WHERE id = $1', [userId]);
      res.json({ success: true });
    }
    else if (pathname.match(/^\/api\/users\/[^/]+\/stats$/) && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[3];
      
      const [watchHistory] = await executeQuery(
        'SELECT COUNT(DISTINCT "video_id") as "totalWatched" FROM watch_history WHERE "user_id" = $1',
        [userId]
      );
      
      const [favorites] = await executeQuery(
        'SELECT COUNT(*) as "totalFavorites" FROM favorites WHERE "user_id" = $1',
        [userId]
      );
      
      const [ratings] = await executeQuery(
        'SELECT COUNT(*) as "totalRatings" FROM ratings WHERE "user_id" = $1',
        [userId]
      );
      
      const [watchTime] = await executeQuery(`
        SELECT SUM(
          CASE 
            WHEN wh.progress > 0 THEN (wh.progress / 100.0) * COALESCE(CAST(SUBSTRING(v.duration FROM '^[0-9]+') AS INTEGER), 60)
            ELSE 0
          END
        ) as "totalMinutes"
        FROM watch_history wh
        LEFT JOIN videos v ON wh."video_id" = v.uuid
        WHERE wh."user_id" = $1
      `, [userId]);
      
      const totalHours = Math.floor((watchTime[0].totalMinutes || 0) / 60);
      
      res.json({
        totalWatched: watchHistory[0].totalWatched || 0,
        totalFavorites: favorites[0].totalFavorites || 0,
        totalRatings: ratings[0].totalRatings || 0,
        totalHours: totalHours
      });
    }
    else if (pathname.match(/^\/api\/users\/[^/]+\/activity$/) && req.method === 'GET') {
      const user = authenticateToken(req);
      const userId = pathParts[3];
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const limit = parseInt(searchParams.get('limit')) || 10;
      
      const [watchHistory] = await executeQuery(`
        SELECT 'watch' as type, wh."watched_at" as date, v.uuid as "videoId", v.title, v.thumbnail, v.category, v."average_rating", v.type as "videoType"
        FROM watch_history wh
        JOIN videos v ON wh."video_id" = v.uuid
        WHERE wh."user_id" = $1
        ORDER BY wh."watched_at" DESC
        LIMIT $2
      `, [userId, Math.ceil(limit / 3)]);
      
      const [recentFavorites] = await executeQuery(`
        SELECT 'favorite' as type, f."added_at" as date, v.uuid as "videoId", v.title, v.thumbnail, v.category, v."average_rating", v.type as "videoType"
        FROM favorites f
        JOIN videos v ON f."video_id" = v.uuid
        WHERE f."user_id" = $1
        ORDER BY f."added_at" DESC
        LIMIT $2
      `, [userId, Math.ceil(limit / 3)]);
      
      const [recentRatings] = await executeQuery(`
        SELECT 'rate' as type, r."created_at" as date, v.uuid as "videoId", v.title, v.thumbnail, v.category, v."average_rating", v.type as "videoType", r.rating as "userRating"
        FROM ratings r
        JOIN videos v ON r."video_id" = v.uuid
        WHERE r."user_id" = $1
        ORDER BY r."created_at" DESC
        LIMIT $2
      `, [userId, Math.ceil(limit / 3)]);
      
      const allActivities = [
        ...watchHistory.map(item => ({ ...item, date: new Date(item.date) })),
        ...recentFavorites.map(item => ({ ...item, date: new Date(item.date) })),
        ...recentRatings.map(item => ({ ...item, date: new Date(item.date) }))
      ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
      
      res.json(allActivities);
    }
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('Users error:', error);
    const errorResponse = handleDbError(error, 'gestion des utilisateurs');
    res.status(500).json(errorResponse);
  }
};
