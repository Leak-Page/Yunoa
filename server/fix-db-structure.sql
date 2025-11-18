
-- Ajouter la table manquante pour les codes de vérification email
CREATE TABLE IF NOT EXISTS `email_verification_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(6) COLLATE utf8mb4_general_ci NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_code` (`email`, `code`),
  KEY `idx_expires_at` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Corriger la structure de la table notifications pour correspondre au code
ALTER TABLE `notifications` 
CHANGE COLUMN `user_id` `userId` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
CHANGE COLUMN `is_read` `isRead` tinyint(1) DEFAULT '0',
CHANGE COLUMN `created_at` `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
CHANGE COLUMN `read_at` `readAt` datetime NULL DEFAULT NULL;
