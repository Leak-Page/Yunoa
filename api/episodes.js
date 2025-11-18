import { v4 as uuidv4 } from 'uuid';
import { executeQuery, handleDbError } from './_lib/db.js';
import { authenticateToken, requireAdmin, corsHeaders } from './_lib/auth.js';

export default async function handler(req, res) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, seriesId } = req.query;

  try {
    // GET /api/episodes?seriesId=xxx → récupérer tous les épisodes d'une série
    if (req.method === 'GET' && seriesId) {
      const [rows] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE "seriesId" = $1 ORDER BY "seasonNumber", "episodeNumber"', [seriesId]);
      return res.json(rows);
    }

    // GET /api/episodes?id=xxx → récupérer un épisode spécifique
    if (req.method === 'GET' && id) {
      const [rows] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE uuid = $1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Épisode introuvable' });
      return res.json(rows[0]);
    }

    // POST /api/episodes?seriesId=xxx → créer un épisode
    if (req.method === 'POST' && seriesId) {
      const user = authenticateToken(req);
      requireAdmin(user);

      const { episodeNumber, seasonNumber, title, description, thumbnail, videoUrl, duration } = req.body;
      if (!title || !videoUrl || !episodeNumber) return res.status(400).json({ error: 'Champs requis manquants' });

      // Vérifier si un épisode avec le même numéro existe déjà dans la même saison
      const [existingEpisodes] = await executeQuery(
        'SELECT uuid FROM episodes WHERE "seriesId" = $1 AND "seasonNumber" = $2 AND "episodeNumber" = $3', 
        [seriesId, seasonNumber || 1, episodeNumber]
      );
      
      if (existingEpisodes.length > 0) {
        return res.status(409).json({ 
          error: `Un épisode ${episodeNumber} existe déjà dans la saison ${seasonNumber || 1}. Veuillez choisir un autre numéro d'épisode.`,
          code: 'EPISODE_EXISTS'
        });
      }

      const newId = uuidv4();
      await executeQuery(
        'INSERT INTO episodes (uuid, "seriesId", "episodeNumber", "seasonNumber", title, description, thumbnail, "videoUrl", duration, views, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [newId, seriesId, episodeNumber, seasonNumber || 1, title, description, thumbnail, videoUrl, duration, 0, new Date(), new Date()]
      );

      const [episode] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE uuid = $1', [newId]);
      return res.json(episode[0]);
    }

    // PUT /api/episodes?id=xxx → modifier un épisode
    if (req.method === 'PUT' && id) {
      const user = authenticateToken(req);
      requireAdmin(user);

      const { episodeNumber, seasonNumber, title, description, thumbnail, videoUrl, duration } = req.body;
      const [result] = await executeQuery(
        'UPDATE episodes SET "episodeNumber" = $1, "seasonNumber" = $2, title = $3, description = $4, thumbnail = $5, "videoUrl" = $6, duration = $7, "updatedAt" = $8 WHERE uuid = $9',
        [episodeNumber, seasonNumber || 1, title, description, thumbnail, videoUrl, duration, new Date(), id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Épisode non trouvé' });

      const [updated] = await executeQuery('SELECT uuid as id, title, description, thumbnail, "videoUrl", duration, "episodeNumber", "seasonNumber", views FROM episodes WHERE uuid = $1', [id]);
      return res.json(updated[0]);
    }

    // DELETE /api/episodes?id=xxx → supprimer un épisode
    if (req.method === 'DELETE' && id) {
      const user = authenticateToken(req);
      requireAdmin(user);

      const [result] = await executeQuery('DELETE FROM episodes WHERE uuid = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Épisode non trouvé' });

      return res.json({ message: 'Épisode supprimé avec succès' });
    }

    return res.status(405).json({ error: 'Méthode ou paramètres invalides' });
  } catch (error) {
    console.error('Erreur API épisode:', error);
    return res.status(500).json(handleDbError(error, 'épisode'));
  }
}
