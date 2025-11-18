import { executeQuery } from './_lib/db.js';
import { corsHeaders } from './_lib/auth.js';

export default async (req, res) => {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (pathname === '/api/search' && req.method === 'GET') {
      const q = searchParams.get('q');
      const category = searchParams.get('category');
      const year = searchParams.get('year');
      const rating = searchParams.get('rating');

      let query = `
        SELECT v.uuid as id, v.title, v.description, v.thumbnail, v."videoUrl", 
               v.duration, v.category, v.language, v.year, v.views, 
               v."averageRating", v."totalRatings", v."createdAt", v."createdBy",
               v.type, v."totalSeasons", v."totalEpisodes", u.username as "createdByUsername" 
        FROM videos v 
        LEFT JOIN users u ON v."createdBy" = u.uuid 
        WHERE 1=1
      `;
      const params = [];

      if (q) {
        query += ` AND (v.title ILIKE ? OR v.description ILIKE ? OR v.category ILIKE ?)`;
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      if (category) {
        query += ` AND v.category = ?`;
        params.push(category);
      }

      if (year) {
        query += ` AND v.year = ?`;
        params.push(year);
      }

      if (rating) {
        query += ` AND v."averageRating" >= ?`;
        params.push(rating);
      }

      query += ` ORDER BY v."createdAt" DESC`;

      const [videos] = await executeQuery(query, params);
      res.json(videos);
    }
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};