
-- Database initialization script
CREATE DATABASE IF NOT EXISTS yunoa_db;
USE yunoa_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  isFirstLogin BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail VARCHAR(500),
  videoUrl VARCHAR(500) NOT NULL,
  duration INT DEFAULT 0,
  views INT DEFAULT 0,
  type ENUM('movie', 'series') DEFAULT 'movie',
  category VARCHAR(100),
  year INT,
  rating DECIMAL(3,1) DEFAULT 0.0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Episodes table for series
CREATE TABLE IF NOT EXISTS episodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  seriesId CHAR(36) NOT NULL,
  seasonNumber INT NOT NULL,
  episodeNumber INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail VARCHAR(500),
  videoUrl VARCHAR(500) NOT NULL,
  duration INT DEFAULT 0,
  views INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (seriesId) REFERENCES videos(uuid) ON DELETE CASCADE
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User favorites
CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId CHAR(36) NOT NULL,
  videoId CHAR(36) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(uuid) ON DELETE CASCADE,
  FOREIGN KEY (videoId) REFERENCES videos(uuid) ON DELETE CASCADE,
  UNIQUE KEY unique_favorite (userId, videoId)
);

-- Watch history
CREATE TABLE IF NOT EXISTS watch_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId CHAR(36) NOT NULL,
  videoId CHAR(36) NOT NULL,
  progress DECIMAL(5,2) DEFAULT 0.00,
  watchedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(uuid) ON DELETE CASCADE,
  FOREIGN KEY (videoId) REFERENCES videos(uuid) ON DELETE CASCADE,
  UNIQUE KEY unique_history (userId, videoId)
);

-- Ratings
CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId CHAR(36) NOT NULL,
  videoId CHAR(36) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(uuid) ON DELETE CASCADE,
  FOREIGN KEY (videoId) REFERENCES videos(uuid) ON DELETE CASCADE,
  UNIQUE KEY unique_rating (userId, videoId)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  userId CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(uuid) ON DELETE CASCADE
);

-- Email verification codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_token (token(255)),
  INDEX idx_expires (expires_at)
);

-- Subtitles table
CREATE TABLE IF NOT EXISTS subtitles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) UNIQUE NOT NULL,
  videoId CHAR(36) NOT NULL,
  language VARCHAR(10) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(500) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (videoId) REFERENCES videos(uuid) ON DELETE CASCADE
);

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (uuid, username, email, password, role, isFirstLogin) 
VALUES (
  'admin-uuid-1234-5678-9012',
  'admin',
  'admin@yunoa.xyz',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VJnQP1wuW',
  'admin',
  FALSE
);

-- Insert default categories
INSERT IGNORE INTO categories (uuid, name, description) VALUES
('cat-action-uuid', 'Action', 'Films et séries d\'action'),
('cat-comedy-uuid', 'Comédie', 'Films et séries comiques'),
('cat-drama-uuid', 'Drame', 'Films et séries dramatiques'),
('cat-horror-uuid', 'Horreur', 'Films et séries d\'horreur'),
('cat-scifi-uuid', 'Science-Fiction', 'Films et séries de science-fiction'),
('cat-romance-uuid', 'Romance', 'Films et séries romantiques'),
('cat-thriller-uuid', 'Thriller', 'Films et séries à suspense'),
('cat-documentary-uuid', 'Documentaire', 'Documentaires et reportages');

