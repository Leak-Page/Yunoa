const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'streamflix-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/subtitles', express.static('subtitles'));

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'subtitle') {
      cb(null, 'subtitles/');
    } else {
      cb(null, 'uploads/');
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'subtitle' && path.extname(file.originalname) !== '.srt') {
      return cb(new Error('Seuls les fichiers .srt sont autorisés pour les sous-titres'));
    }
    cb(null, true);
  }
});

// Database connection
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'streamingdb',
  port: 3306
};

let db;

async function connectDB() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès admin requis' });
  }
  next();
};

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users] = await db.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur de connexion' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const [existingUsers] = await db.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Utilisateur ou email déjà existant' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await db.execute(
      'INSERT INTO users (id, username, email, password, role, createdAt, isFirstLogin) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, 'user', new Date(), 0]
    );

    const token = jwt.sign(
      { id: userId, username, role: 'user', email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: userId,
        username,
        email,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Verify token route
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Videos Routes
app.get('/api/videos', async (req, res) => {
  try {
    const [videos] = await db.execute(`
      SELECT v.*, u.username as createdByUsername 
      FROM videos v 
      LEFT JOIN users u ON v.createdBy = u.id 
      ORDER BY v.createdAt DESC
    `);
    res.json(videos);
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des vidéos' });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const [videos] = await db.execute(`
      SELECT v.*, u.username as createdByUsername 
      FROM videos v 
      LEFT JOIN users u ON v.createdBy = u.id 
      WHERE v.id = ?
    `, [req.params.id]);
    
    if (videos.length === 0) {
      return res.status(404).json({ error: 'Vidéo non trouvée' });
    }

    const video = videos[0];

    // Get subtitles
    const [subtitles] = await db.execute(
      'SELECT * FROM subtitles WHERE videoId = ? ORDER BY isDefault DESC, language ASC',
      [req.params.id]
    );

    // Get episodes if it's a series
    let episodes = [];
    if (video.type === 'series') {
      const [episodeResults] = await db.execute(
        'SELECT * FROM episodes WHERE seriesId = ? ORDER BY seasonNumber ASC, episodeNumber ASC',
        [req.params.id]
      );
      episodes = episodeResults;
    }

    video.subtitles = subtitles;
    video.episodes = episodes;

    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la vidéo' });
  }
});

app.post('/api/videos', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      title, description, thumbnail, videoUrl, duration, category, 
      language, year, type, totalSeasons, totalEpisodes 
    } = req.body;
    
    const videoId = uuidv4();
    
    await db.execute(`
      INSERT INTO videos (
        id, title, description, thumbnail, videoUrl, duration, 
        category, language, year, createdAt, createdBy, type, 
        totalSeasons, totalEpisodes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      videoId, title, description, thumbnail, videoUrl, duration,
      category, language, year, new Date(), req.user.id, type || 'movie',
      totalSeasons || 1, totalEpisodes || 1
    ]);
    
    const [newVideo] = await db.execute(`
      SELECT v.*, u.username as createdByUsername 
      FROM videos v 
      LEFT JOIN users u ON v.createdBy = u.id 
      WHERE v.id = ?
    `, [videoId]);
    
    res.json(newVideo[0]);
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la vidéo' });
  }
});

app.put('/api/videos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      title, description, thumbnail, videoUrl, duration, category, 
      language, year, type, totalSeasons, totalEpisodes 
    } = req.body;
    
    await db.execute(`
      UPDATE videos SET 
        title = ?, description = ?, thumbnail = ?, videoUrl = ?, 
        duration = ?, category = ?, language = ?, year = ?, 
        type = ?, totalSeasons = ?, totalEpisodes = ?
      WHERE id = ?
    `, [
      title, description, thumbnail, videoUrl, duration, category,
      language, year, type || 'movie', totalSeasons || 1, 
      totalEpisodes || 1, req.params.id
    ]);
    
    const [updatedVideo] = await db.execute(`
      SELECT v.*, u.username as createdByUsername 
      FROM videos v 
      LEFT JOIN users u ON v.createdBy = u.id 
      WHERE v.id = ?
    `, [req.params.id]);
    
    res.json(updatedVideo[0]);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la vidéo' });
  }
});

app.delete('/api/videos/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la vidéo' });
  }
});

// Episodes Routes
app.post('/api/videos/:id/episodes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { episodeNumber, seasonNumber, title, description, thumbnail, videoUrl, duration } = req.body;
    const episodeId = uuidv4();
    
    await db.execute(`
      INSERT INTO episodes (
        id, seriesId, episodeNumber, seasonNumber, title, 
        description, thumbnail, videoUrl, duration, views, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      episodeId, req.params.id, episodeNumber, seasonNumber || 1,
      title, description, thumbnail, videoUrl, duration, 0, new Date()
    ]);
    
    const [newEpisode] = await db.execute(
      'SELECT * FROM episodes WHERE id = ?',
      [episodeId]
    );
    
    res.json(newEpisode[0]);
  } catch (error) {
    console.error('Create episode error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'épisode' });
  }
});

// Subtitles Routes
app.post('/api/videos/:id/subtitles', authenticateToken, requireAdmin, upload.single('subtitle'), async (req, res) => {
  try {
    const { language, languageName, isDefault } = req.body;
    const subtitleId = uuidv4();
    const subtitleUrl = `/subtitles/${req.file.filename}`;
    
    // If this is set as default, unset other defaults
    if (isDefault === 'true') {
      await db.execute(
        'UPDATE subtitles SET isDefault = 0 WHERE videoId = ?',
        [req.params.id]
      );
    }
    
    await db.execute(`
      INSERT INTO subtitles (
        id, videoId, language, languageName, subtitleUrl, isDefault, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      subtitleId, req.params.id, language, languageName, 
      subtitleUrl, isDefault === 'true' ? 1 : 0, new Date()
    ]);
    
    const [newSubtitle] = await db.execute(
      'SELECT * FROM subtitles WHERE id = ?',
      [subtitleId]
    );
    
    res.json(newSubtitle[0]);
  } catch (error) {
    console.error('Upload subtitle error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload des sous-titres' });
  }
});

app.delete('/api/subtitles/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM subtitles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete subtitle error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du sous-titre' });
  }
});

// Increment views
app.post('/api/videos/:id/views', async (req, res) => {
  try {
    await db.execute('UPDATE videos SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Increment views error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des vues' });
  }
});

// Categories Routes
app.get('/api/categories', async (req, res) => {
  try {
    const [categories] = await db.execute(`
      SELECT c.*, COUNT(v.id) as videoCount 
      FROM categories c 
      LEFT JOIN videos v ON c.name = v.category 
      GROUP BY c.id 
      ORDER BY c.name
    `);
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

app.post('/api/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const categoryId = uuidv4();
    
    await db.execute(
      'INSERT INTO categories (id, name, description, color) VALUES (?, ?, ?, ?)',
      [categoryId, name, description, color]
    );
    
    const [newCategory] = await db.execute(
      'SELECT * FROM categories WHERE id = ?',
      [categoryId]
    );
    
    res.json(newCategory[0]);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
});

app.put('/api/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    await db.execute(
      'UPDATE categories SET name = ?, description = ?, color = ? WHERE id = ?',
      [name, description, color, req.params.id]
    );
    
    const [updatedCategory] = await db.execute(
      'SELECT * FROM categories WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updatedCategory[0]);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie' });
  }
});

app.delete('/api/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
  }
});

// Users Routes
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT 
        u.id, u.username, u.email, u.role, u.createdAt,
        COUNT(DISTINCT f.id) as totalFavorites,
        COUNT(DISTINCT wt.id) as totalWatched
      FROM users u
      LEFT JOIN favorites f ON u.id = f.userId
      LEFT JOIN watch_time wt ON u.id = wt.userId
      GROUP BY u.id
      ORDER BY u.createdAt DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, role } = req.body;
    
    await db.execute(
      'UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?',
      [username, email, role, req.params.id]
    );
    
    const [updatedUser] = await db.execute(
      'SELECT id, username, email, role, createdAt FROM users WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updatedUser[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

// Favorites Routes
app.get('/api/favorites/:userId', authenticateToken, async (req, res) => {
  try {
    const [favorites] = await db.execute(`
      SELECT f.*, v.title, v.thumbnail, v.category, v.year, v.averageRating
      FROM favorites f
      JOIN videos v ON f.videoId = v.id
      WHERE f.userId = ?
      ORDER BY f.addedAt DESC
    `, [req.params.userId]);
    
    res.json(favorites);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des favoris' });
  }
});

app.post('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { userId, videoId } = req.body;
    
    // Check if already exists
    const [existing] = await db.execute(
      'SELECT id FROM favorites WHERE userId = ? AND videoId = ?',
      [userId, videoId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Déjà dans les favoris' });
    }
    
    const favoriteId = uuidv4();
    await db.execute(
      'INSERT INTO favorites (id, userId, videoId, addedAt) VALUES (?, ?, ?, ?)',
      [favoriteId, userId, videoId, new Date()]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout aux favoris' });
  }
});

app.delete('/api/favorites/:userId/:videoId', authenticateToken, async (req, res) => {
  try {
    await db.execute(
      'DELETE FROM favorites WHERE userId = ? AND videoId = ?',
      [req.params.userId, req.params.videoId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du favori' });
  }
});

// Watch History Routes
app.get('/api/watch-history/:userId', authenticateToken, async (req, res) => {
  try {
    const [history] = await db.execute(`
      SELECT wt.*, v.title, v.thumbnail, v.category, v.duration
      FROM watch_time wt
      JOIN videos v ON wt.videoId = v.id
      WHERE wt.userId = ?
      ORDER BY wt.lastWatched DESC
      LIMIT 50
    `, [req.params.userId]);
    
    res.json(history);
  } catch (error) {
    console.error('Get watch history error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

app.post('/api/watch-history', authenticateToken, async (req, res) => {
  try {
    const { userId, videoId, progress } = req.body;
    const watchId = uuidv4();
    
    await db.execute(`
      INSERT INTO watch_time (id, userId, videoId, progress, lastWatched) 
      VALUES (?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
        progress = VALUES(progress), 
        lastWatched = VALUES(lastWatched)
    `, [watchId, userId, videoId, progress, new Date()]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Add watch history error:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de l\'historique' });
  }
});

// Ratings Routes
app.get('/api/ratings/:userId/:videoId', authenticateToken, async (req, res) => {
  try {
    const [ratings] = await db.execute(
      'SELECT rating FROM ratings WHERE userId = ? AND videoId = ?',
      [req.params.userId, req.params.videoId]
    );
    
    res.json({ rating: ratings.length > 0 ? ratings[0].rating : null });
  } catch (error) {
    console.error('Get rating error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la note' });
  }
});

app.post('/api/ratings', authenticateToken, async (req, res) => {
  try {
    const { userId, videoId, rating } = req.body;
    const ratingId = uuidv4();
    
    await db.execute(`
      INSERT INTO ratings (id, userId, videoId, rating, ratedAt) 
      VALUES (?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
        rating = VALUES(rating), 
        ratedAt = VALUES(ratedAt)
    `, [ratingId, userId, videoId, rating, new Date()]);
    
    // Update video average rating
    const [avgResult] = await db.execute(`
      SELECT AVG(rating) as avgRating, COUNT(*) as totalRatings 
      FROM ratings WHERE videoId = ?
    `, [videoId]);
    
    await db.execute(
      'UPDATE videos SET averageRating = ?, totalRatings = ? WHERE id = ?',
      [parseFloat(avgResult[0].avgRating || 0), avgResult[0].totalRatings, videoId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Rate video error:', error);
    res.status(500).json({ error: 'Erreur lors de la notation' });
  }
});

// Search Routes
app.get('/api/search', async (req, res) => {
  try {
    const { q, category, year, rating } = req.query;
    let query = `
      SELECT v.*, u.username as createdByUsername 
      FROM videos v 
      LEFT JOIN users u ON v.createdBy = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      query += ` AND (v.title LIKE ? OR v.description LIKE ? OR v.category LIKE ?)`;
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
      query += ` AND v.averageRating >= ?`;
      params.push(rating);
    }

    query += ` ORDER BY v.createdAt DESC`;

    const [videos] = await db.execute(query, params);
    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

// Top rated videos
app.get('/api/top-rated', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    const [videos] = await db.execute(`
      SELECT v.*, u.username as createdByUsername 
      FROM videos v 
      LEFT JOIN users u ON v.createdBy = u.id 
      WHERE v.totalRatings > 0 
      ORDER BY v.averageRating DESC, v.totalRatings DESC 
      LIMIT ?
    `, [limit]);
    
    res.json(videos);
  } catch (error) {
    console.error('Get top rated error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des vidéos les mieux notées' });
  }
});

// Notifications Routes
app.get('/api/notifications/:userId', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await db.execute(`
      SELECT * FROM notifications 
      WHERE userId = ? 
      ORDER BY createdAt DESC
    `, [req.params.userId]);
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des notifications' });
  }
});

app.get('/api/notifications/:userId/unread', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await db.execute(`
      SELECT * FROM notifications 
      WHERE userId = ? AND isRead = FALSE
      ORDER BY createdAt DESC
    `, [req.params.userId]);
    
    res.json(notifications);
  } catch (error) {
    console.error('Get unread notifications error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des notifications non lues' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.execute(
      'UPDATE notifications SET isRead = TRUE, readAt = ? WHERE id = ?',
      [new Date(), req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Erreur lors du marquage de la notification' });
  }
});

app.put('/api/notifications/:userId/read-all', authenticateToken, async (req, res) => {
  try {
    await db.execute(
      'UPDATE notifications SET isRead = TRUE, readAt = ? WHERE userId = ?',
      [new Date(), req.params.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Erreur lors du marquage des notifications' });
  }
});

app.post('/api/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, title, message } = req.body;
    const notificationId = uuidv4();
    
    await db.execute(`
      INSERT INTO notifications (id, userId, title, message, createdAt, isRead)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [notificationId, userId, title, message, new Date(), false]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la notification' });
  }
});

// User Stats and Activity Routes
app.get('/api/users/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get watch history count
    const [watchHistory] = await db.execute(
      'SELECT COUNT(DISTINCT videoId) as totalWatched FROM watch_time WHERE userId = ?',
      [userId]
    );
    
    // Get favorites count
    const [favorites] = await db.execute(
      'SELECT COUNT(*) as totalFavorites FROM favorites WHERE userId = ?',
      [userId]
    );
    
    // Get ratings count
    const [ratings] = await db.execute(
      'SELECT COUNT(*) as totalRatings FROM ratings WHERE userId = ?',
      [userId]
    );
    
    // Calculate total watch time (simulate based on videos watched)
    const [watchTime] = await db.execute(`
      SELECT SUM(
        CASE 
          WHEN wt.progress > 0 THEN (wt.progress / 100) * COALESCE(v.duration, 60)
          ELSE 0
        END
      ) as totalMinutes
      FROM watch_time wt
      LEFT JOIN videos v ON wt.videoId = v.id
      WHERE wt.userId = ?
    `, [userId]);
    
    const totalHours = Math.floor((watchTime[0].totalMinutes || 0) / 60);
    
    res.json({
      totalWatched: watchHistory[0].totalWatched || 0,
      totalFavorites: favorites[0].totalFavorites || 0,
      totalRatings: ratings[0].totalRatings || 0,
      totalHours: totalHours
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

app.get('/api/users/:userId/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get recent activities from different sources
    const activities = [];
    
    // Recent watch history
    const [watchHistory] = await db.execute(`
      SELECT 'watch' as type, wt.lastWatched as date, v.id as videoId, v.title, v.thumbnail, v.category, v.averageRating, v.type as videoType
      FROM watch_time wt
      JOIN videos v ON wt.videoId = v.id
      WHERE wt.userId = ?
      ORDER BY wt.lastWatched DESC
      LIMIT ?
    `, [userId, Math.ceil(limit / 3)]);
    
    // Recent favorites
    const [recentFavorites] = await db.execute(`
      SELECT 'favorite' as type, f.addedAt as date, v.id as videoId, v.title, v.thumbnail, v.category, v.averageRating, v.type as videoType
      FROM favorites f
      JOIN videos v ON f.videoId = v.id
      WHERE f.userId = ?
      ORDER BY f.addedAt DESC
      LIMIT ?
    `, [userId, Math.ceil(limit / 3)]);
    
    // Recent ratings
    const [recentRatings] = await db.execute(`
      SELECT 'rate' as type, r.ratedAt as date, v.id as videoId, v.title, v.thumbnail, v.category, v.averageRating, v.type as videoType, r.rating as userRating
      FROM ratings r
      JOIN videos v ON r.videoId = v.id
      WHERE r.userId = ?
      ORDER BY r.ratedAt DESC
      LIMIT ?
    `, [userId, Math.ceil(limit / 3)]);
    
    // Combine and sort all activities
    const allActivities = [
      ...watchHistory[0].map(item => ({ ...item, date: new Date(item.date) })),
      ...recentFavorites[0].map(item => ({ ...item, date: new Date(item.date) })),
      ...recentRatings[0].map(item => ({ ...item, date: new Date(item.date) }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
    
    res.json(allActivities);
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'activité' });
  }
});

// Statistics Routes
app.get('/api/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [videoStats] = await db.execute(`
      SELECT 
        COUNT(*) as totalVideos,
        SUM(views) as totalViews,
        AVG(averageRating) as avgRating,
        COUNT(CASE WHEN type = 'movie' THEN 1 END) as totalMovies,
        COUNT(CASE WHEN type = 'series' THEN 1 END) as totalSeries
      FROM videos
    `);
    
    const [userStats] = await db.execute('SELECT COUNT(*) as totalUsers FROM users');
    const [categoryStats] = await db.execute('SELECT COUNT(*) as totalCategories FROM categories');
    const [recentUsers] = await db.execute(`
      SELECT COUNT(*) as recentUsers 
      FROM users 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    
    const [topCategories] = await db.execute(`
      SELECT category, COUNT(*) as count, SUM(views) as totalViews
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
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Admin access: fragment5685 or nazam`);
  });
});
