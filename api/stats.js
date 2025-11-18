
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

  try {
    if (req.method === 'GET') {
      const user = authenticateToken(req);
      requireAdmin(user);

      try {
        const [videoStats] = await executeQuery(`
          SELECT 
            COUNT(*) as "totalVideos",
            SUM(views) as "totalViews",
            AVG("averageRating") as "avgRating",
            COUNT(CASE WHEN type = 'movie' THEN 1 END) as "totalMovies",
            COUNT(CASE WHEN type = 'series' THEN 1 END) as "totalSeries"
          FROM videos
        `);
        
        const [userStats] = await executeQuery('SELECT COUNT(*) as "totalUsers" FROM users');
        const [categoryStats] = await executeQuery('SELECT COUNT(*) as "totalCategories" FROM categories');
        const [recentUsers] = await executeQuery(`
          SELECT COUNT(*) as "recentUsers" 
          FROM users 
          WHERE "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '7 days'
        `);
        
        const [topCategories] = await executeQuery(`
          SELECT category, COUNT(*) as count, SUM(views) as "totalViews"
          FROM videos 
          WHERE category IS NOT NULL
          GROUP BY category 
          ORDER BY count DESC 
          LIMIT 5
        `);

        const stats = {
          totalVideos: videoStats[0].totalVideos,
          totalMovies: videoStats[0].totalMovies,
          totalSeries: videoStats[0].totalSeries,
          totalUsers: userStats[0].totalUsers,
          totalCategories: categoryStats[0].totalCategories,
          totalViews: videoStats[0].totalViews || 0,
          averageRating: parseFloat(videoStats[0].avgRating || 0).toFixed(1),
          recentUsers: recentUsers[0].recentUsers,
          topCategories: topCategories
        };
        
        res.json(stats);
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          const fallbackResponse = getFallbackResponse('stats', dbError);
          return res.status(200).json(fallbackResponse.data);
        }
        throw dbError;
      }
    }
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('Stats error:', error);
    const errorResponse = handleDbError(error, 'récupération des statistiques');
    res.status(500).json(errorResponse);
  }
};
