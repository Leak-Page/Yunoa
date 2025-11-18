-- Script de migration et correction PostgreSQL pour Yunoa
-- Ce script corrige tous les problèmes de migration MySQL vers PostgreSQL

-- 1. Nettoyage des tables existantes si nécessaire
DROP TABLE IF EXISTS subtitles CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS email_verification_codes CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS watch_history CASCADE;
DROP TABLE IF EXISTS watch_time CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS episodes CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Recréation des tables avec la syntaxe PostgreSQL correcte

-- Table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    "isFirstLogin" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des catégories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#e74c3c',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des vidéos
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail VARCHAR(500),
    "videoUrl" VARCHAR(500),
    duration VARCHAR(20),
    category TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'Français',
    year INTEGER NOT NULL,
    views INTEGER DEFAULT 0,
    "averageRating" DECIMAL(3,2) DEFAULT 0.00,
    "totalRatings" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'movie' CHECK (type IN ('movie', 'series')),
    "totalSeasons" INTEGER DEFAULT 1,
    "totalEpisodes" INTEGER DEFAULT 1
);

-- Table des épisodes
CREATE TABLE episodes (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    "seriesId" VARCHAR(50) NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "seasonNumber" INTEGER DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail VARCHAR(500),
    "videoUrl" VARCHAR(500) NOT NULL,
    duration VARCHAR(20),
    views INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("seriesId", "seasonNumber", "episodeNumber")
);

-- Table des favoris
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    "userId" VARCHAR(50) NOT NULL,
    "videoId" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "addedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "videoId")
);

-- Table de l'historique de visionnage
CREATE TABLE watch_history (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    "userId" VARCHAR(50) NOT NULL,
    "videoId" VARCHAR(50) NOT NULL,
    "episodeId" VARCHAR(50),
    progress DECIMAL(5,2) DEFAULT 0.00,
    "watchedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "videoId", "episodeId")
);

-- Table du temps de visionnage (legacy)
CREATE TABLE watch_time (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    "userId" VARCHAR(36) NOT NULL,
    "videoId" VARCHAR(36) NOT NULL,
    progress FLOAT DEFAULT 0,
    "lastWatched" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des évaluations
CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    "userId" VARCHAR(50) NOT NULL,
    "videoId" VARCHAR(50) NOT NULL,
    rating DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "videoId")
);

-- Table des notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE DEFAULT uuid_generate_v4()::text,
    "userId" VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT NOT NULL,
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP
);

-- Table des codes de vérification email
CREATE TABLE email_verification_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    code VARCHAR(6) NOT NULL,
    used BOOLEAN DEFAULT false,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des réinitialisations de mot de passe
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des sous-titres
CREATE TABLE subtitles (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(50) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    "videoId" VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    "languageName" VARCHAR(50) NOT NULL,
    "subtitleUrl" VARCHAR(500) NOT NULL,
    "isDefault" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Création des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_videos_search ON videos USING gin(to_tsvector('french', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_videos_category_year ON videos(category, year);
CREATE INDEX IF NOT EXISTS idx_episodes_search ON episodes USING gin(to_tsvector('french', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_watch_history_user_date ON watch_history("userId", "watchedAt");
CREATE INDEX IF NOT EXISTS idx_email_code ON email_verification_codes(email, code);
CREATE INDEX IF NOT EXISTS idx_expires_at ON email_verification_codes("expiresAt");
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId", "isRead");
CREATE INDEX IF NOT EXISTS idx_ratings_video ON ratings("videoId");
CREATE INDEX IF NOT EXISTS idx_episodes_series ON episodes("seriesId", "seasonNumber", "episodeNumber");

-- 5. Fonction pour mettre à jour automatiquement updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Triggers pour auto-update
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
DROP TRIGGER IF EXISTS update_episodes_updated_at ON episodes;
DROP TRIGGER IF EXISTS update_watch_history_updated_at ON watch_history;
DROP TRIGGER IF EXISTS update_ratings_updated_at ON ratings;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_episodes_updated_at BEFORE UPDATE ON episodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_watch_history_updated_at BEFORE UPDATE ON watch_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Insertion des données par défaut
INSERT INTO users (uuid, username, email, password, role, "isFirstLogin") 
VALUES ('7730af01-ce1a-43e6-90a1-cf6d3535ca6d', 'fragment5685', 'graditoss82@gmail.com', '$2b$12$mlMkE7JXbZl/SpEyrk3xYeyLdbV5GHKWWQlIF6OtsVZlXbLQtpGeq', 'admin', false)
ON CONFLICT (uuid) DO NOTHING;

INSERT INTO users (uuid, username, email, password, role, "isFirstLogin") 
VALUES ('a34dc539-f2aa-4daa-9ccd-03cb56df9787', 'Karnage', 'karnagedev@gmail.com', '$2b$12$.10tW2zQBGYdE5ETW/ptfen/2w8QcEKvKaZQ7Ew9uWSibG/yQWCEi', 'admin', false)
ON CONFLICT (uuid) DO NOTHING;

-- Catégories par défaut
INSERT INTO categories (uuid, name, description, color) VALUES 
('cat-1', 'Action', 'Films et séries d''action palpitants', '#ef4444'),
('cat-10', 'Crime', 'Histoires criminelles et policiaires', '#dc2626'),
('cat-2', 'Drama', 'Histoires dramatiques et émotionnelles', '#3b82f6'),
('cat-3', 'Comedy', 'Divertissement humoristique', '#f59e0b'),
('cat-4', 'Horror', 'Films d''horreur et de suspense', '#8b5cf6'),
('cat-6', 'Sci-Fi', 'Science-fiction et futur', '#06b6d4'),
('cat-7', 'Romance', 'Histoires d''amour romantiques', '#ec4899'),
('cat-9', 'Animation', 'Films et séries d''animation', '#f97316')
ON CONFLICT (uuid) DO NOTHING;

-- 8. Message de confirmation
-- Votre base de données PostgreSQL est maintenant configurée et corrigée !