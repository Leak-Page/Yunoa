
import { v4 as uuidv4 } from 'uuid';
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
    if (pathname === '/api/categories' && req.method === 'GET') {
      try {
        const [categories] = await executeQuery(`
          SELECT c.uuid as id, c.name, c.description, c.color, COUNT(v.id) as videoCount 
          FROM categories c 
          LEFT JOIN videos v ON c.name = v.category 
          GROUP BY c.uuid, c.name, c.description, c.color 
          ORDER BY c.name
        `);
        res.json(categories);
      } catch (dbError) {
        if (shouldUseFallback(dbError)) {
          const fallbackResponse = getFallbackResponse('categories', dbError);
          return res.status(200).json(fallbackResponse.data);
        }
        throw dbError;
      }
    }
    else if (pathname === '/api/categories' && req.method === 'POST') {
      const user = authenticateToken(req);
      requireAdmin(user);

      const { name, description, color } = req.body;
      const categoryId = uuidv4();
      
      await executeQuery(
        'INSERT INTO categories (uuid, name, description, color) VALUES (?, ?, ?, ?)',
        [categoryId, name, description, color]
      );
      
      const [newCategory] = await executeQuery(
        'SELECT uuid as id, name, description, color FROM categories WHERE uuid = ?',
        [categoryId]
      );
      
      res.json(newCategory[0]);
    }
    else if (pathname.match(/^\/api\/categories\/[^/]+$/) && req.method === 'PUT') {
      const user = authenticateToken(req);
      requireAdmin(user);
      const categoryId = pathParts[3];

      const { name, description, color } = req.body;
      
      await executeQuery(
        'UPDATE categories SET name = ?, description = ?, color = ? WHERE uuid = ?',
        [name, description, color, categoryId]
      );
      
      const [updatedCategory] = await executeQuery(
        'SELECT uuid as id, name, description, color FROM categories WHERE uuid = ?',
        [categoryId]
      );
      
      res.json(updatedCategory[0]);
    }
    else if (pathname.match(/^\/api\/categories\/[^/]+$/) && req.method === 'DELETE') {
      const user = authenticateToken(req);
      requireAdmin(user);
      const categoryId = pathParts[3];

      await executeQuery('DELETE FROM categories WHERE uuid = ?', [categoryId]);
      res.json({ success: true });
    }
    else {
      res.status(404).json({ error: 'Route non trouvée' });
    }
  } catch (error) {
    console.error('Categories error:', error);
    const errorResponse = handleDbError(error, 'gestion des catégories');
    res.status(500).json(errorResponse);
  }
};
