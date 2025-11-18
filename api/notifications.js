import { v4 as uuidv4 } from 'uuid';
import { executeQuery, handleDbError } from './_lib/db.js';
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
  const pathParts = pathname.split('/').filter(part => part);

  try {
    // GET /api/notifications/{userId}
    if (
      pathParts.length === 3 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'notifications' &&
      req.method === 'GET'
    ) {
      const user = authenticateToken(req);
      const userId = pathParts[2];

      const [notifications] = await executeQuery(
        `
        SELECT n.id, n.uuid, n."user_id", n.title, n.message, n."is_read"::boolean, 
               n."created_at", n."read_at"
        FROM notifications n
        WHERE n."user_id" = $1
        ORDER BY n."created_at" DESC
        `,
        [userId]
      );

      res.json(notifications);
    }

    // GET /api/notifications/{userId}/unread
    else if (
      pathParts.length === 4 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'notifications' &&
      pathParts[3] === 'unread' &&
      req.method === 'GET'
    ) {
      const user = authenticateToken(req);
      const userId = pathParts[2];

      const [notifications] = await executeQuery(
        `
        SELECT id, uuid, "user_id", title, message, "is_read"::boolean, "created_at", "read_at"
        FROM notifications 
        WHERE "user_id" = $1 AND "is_read" = FALSE
        ORDER BY "created_at" DESC
        `,
        [userId]
      );

      res.json(notifications);
    }

    // PUT /api/notifications/{notificationId}/read
    else if (
      pathParts.length === 4 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'notifications' &&
      pathParts[3] === 'read' &&
      req.method === 'PUT'
    ) {
      const user = authenticateToken(req);
      const notificationId = pathParts[2];

      await executeQuery(
        'UPDATE notifications SET "is_read" = TRUE, "read_at" = $1 WHERE id = $2',
        [new Date(), notificationId]
      );

      res.json({ success: true });
    }

    // PUT /api/notifications/{userId}/read-all
    else if (
      pathParts.length === 4 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'notifications' &&
      pathParts[3] === 'read-all' &&
      req.method === 'PUT'
    ) {
      const user = authenticateToken(req);
      const userId = pathParts[2];

      await executeQuery(
        'UPDATE notifications SET "is_read" = TRUE, "read_at" = $1 WHERE "user_id" = $2',
        [new Date(), userId]
      );

      res.json({ success: true });
    }

    // GET /api/notifications (base route)
    else if (
      pathParts.length === 2 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'notifications' &&
      req.method === 'GET'
    ) {
      res.json({
        message: 'Notifications API is working',
        endpoints: [
          'GET /api/notifications/{userId}',
          'GET /api/notifications/{userId}/unread',
          'PUT /api/notifications/{notificationId}/read',
          'PUT /api/notifications/{userId}/read-all',
          'POST /api/notifications',
        ],
      });
    }

    // POST /api/notifications
    else if (
      pathParts.length === 2 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'notifications' &&
      req.method === 'POST'
    ) {
      const user = authenticateToken(req);
      requireAdmin(user);

      const { userId, title, message } = req.body;

      if (!userId || !title || !message) {
        return res.status(400).json({ error: 'userId, title et message sont requis' });
      }

      const notificationUuid = uuidv4();
      const currentDate = new Date();

      await executeQuery(
        `
        INSERT INTO notifications (uuid, "user_id", title, message, "created_at", "is_read")
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [notificationUuid, userId, title, message, currentDate, false]
      );

      res.json({ success: true });
    }

    // GET /api/stats
    else if (
      pathParts.length === 2 &&
      pathParts[0] === 'api' &&
      pathParts[1] === 'stats' &&
      req.method === 'GET'
    ) {
      const user = authenticateToken(req);
      requireAdmin(user);

      const [videoStats] = await executeQuery(`
        SELECT 
          COUNT(*) as "totalVideos",
          COALESCE(SUM(views), 0) as "totalViews",
          COALESCE(AVG("average_rating"), 0) as "avgRating",
          COUNT(CASE WHEN type = 'movie' THEN 1 END) as "totalMovies",
          COUNT(CASE WHEN type = 'series' THEN 1 END) as "totalSeries"
        FROM videos
      `);

      const [userStats] = await executeQuery('SELECT COUNT(*) as "totalUsers" FROM profiles');
      const [categoryStats] = await executeQuery('SELECT COUNT(*) as "totalCategories" FROM categories');
      const [recentUsers] = await executeQuery(`
        SELECT COUNT(*) as "recentUsers" 
        FROM profiles 
        WHERE "created_at" >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      `);

      const [topCategories] = await executeQuery(`
        SELECT category, COUNT(*) as count, COALESCE(SUM(views), 0) as "totalViews"
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
        totalViews: videoStats[0].totalViews,
        averageRating: parseFloat(videoStats[0].avgRating).toFixed(1),
        recentUsers: recentUsers[0].recentUsers,
        topCategories: topCategories,
      };

      res.json(stats);
    }

    // Fallback
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('Notifications/Stats error:', error);
    const errorResponse = handleDbError(error, 'gestion des notifications');
    res.status(500).json(errorResponse);
  }
};
