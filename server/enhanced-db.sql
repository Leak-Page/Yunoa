
-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : dim. 13 juil. 2025 à 19:02
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `streamingdb`
--

-- --------------------------------------------------------

--
-- Structure de la table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `color` varchar(20) NOT NULL DEFAULT '#e74c3c',
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `categories`
--

INSERT INTO `categories` (`id`, `uuid`, `name`, `description`, `color`, `createdAt`) VALUES
(1, 'cat-1', 'Action', 'Films et séries d\'action palpitants', '#ef4444', '2025-06-29 18:34:11'),
(2, 'cat-10', 'Crime', 'Histoires criminelles et policiaires', '#dc2626', '2025-06-29 18:34:11'),
(3, 'cat-2', 'Drama', 'Histoires dramatiques et émotionnelles', '#3b82f6', '2025-06-29 18:34:11'),
(4, 'cat-3', 'Comedy', 'Divertissement humoristique', '#f59e0b', '2025-06-29 18:34:11'),
(5, 'cat-4', 'Horror', 'Films d\'horreur et de suspense', '#8b5cf6', '2025-06-29 18:34:11'),
(6, 'cat-6', 'Sci-Fi', 'Science-fiction et futur', '#06b6d4', '2025-06-29 18:34:11'),
(7, 'cat-7', 'Romance', 'Histoires d\'amour romantiques', '#ec4899', '2025-06-29 18:34:11'),
(8, 'cat-9', 'Animation', 'Films et séries d\'animation', '#f97316', '2025-06-29 18:34:11');

-- --------------------------------------------------------

--
-- Structure de la table `email_verification_codes`
--

CREATE TABLE `email_verification_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `code` varchar(6) NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email_code` (`email`, `code`),
  KEY `idx_expires_at` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `episodes`
--

CREATE TABLE `episodes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `seriesId` varchar(50) NOT NULL,
  `episodeNumber` int(11) NOT NULL,
  `seasonNumber` int(11) NOT NULL DEFAULT 1,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `thumbnail` varchar(500) DEFAULT NULL,
  `videoUrl` varchar(500) NOT NULL,
  `duration` varchar(20) DEFAULT NULL,
  `views` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `unique_episode` (`seriesId`,`seasonNumber`,`episodeNumber`),
  KEY `seriesId` (`seriesId`),
  KEY `idx_episodes_search` (`title`,`description`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `episodes`
--

INSERT INTO `episodes` (`id`, `uuid`, `seriesId`, `episodeNumber`, `seasonNumber`, `title`, `description`, `thumbnail`, `videoUrl`, `duration`, `views`, `createdAt`, `updatedAt`) VALUES
(1, '59a6fdab-cb21-421a-9ec3-a99b70aff72c', 'fcfa0e9d-c2ff-4423-841b-112a707af654', 3, 1, 'Episode 3 - ???????', 'Tentés par un prix alléchant en cas de victoire, des centaines de joueurs désargentés acceptent de s\'affronter lors de jeux pour enfants aux enjeux mortels.', 'https://cdn.discordapp.com/attachments/1386226985507885179/1388955539760873584/p20492187_b_h8_aa.png?ex=6864d766&is=686385e6&hm=157bac7f7b37b16c238fe94f4221c426aca47c3d1e1206323e8246cb07835020&', 'https://cdn.discordapp.com/attachments/1386226985507885179/1389245705188540619/SPOILER_Watch_Squid_Game_S01E03_VFF_1080p_WEB_x264_LAZARUS_mp4_The_Ultimate_Free_Video_Hosting_Solution_for.mp4?ex=68693163&is=6867dfe3&hm=8758d022c512d5aef992aa56ade296b6a6dbffcd44b539dcb828daf8b356dda2&', '54min', 0, '2025-06-30 16:10:36', '2025-07-04 18:08:35'),
(2, 'a3007f97-f67e-4ef1-88e3-9ed4ca57d498', 'fcfa0e9d-c2ff-4423-841b-112a707af654', 2, 1, 'Le Choix Fatal', 'Tentés par un prix alléchant en cas de victoire, des centaines de joueurs désargentés acceptent de s\'affronter lors de jeux pour enfants aux enjeux mortels.', 'https://cdn.discordapp.com/attachments/1386226985507885179/1388955539760873584/p20492187_b_h8_aa.png?ex=6864d766&is=686385e6&hm=157bac7f7b37b16c238fe94f4221c426aca47c3d1e1206323e8246cb07835020&', 'https://cdn.discordapp.com/attachments/1386226985507885179/1388899250070360084/SPOILER_Watch_Squid_Game_S01E02_VFF_1080p_WEB_x264_LAZARUS_mp4_The_Ultimate_Free_Video_Hosting_Solution_for.mp4?ex=68694039&is=6867eeb9&hm=92b0b5302afe7c97832563241b6113cbbba6b07d43dc0fd146a56a83511e8069&', '1h02', 0, '2025-06-30 12:13:32', '2025-07-04 18:08:35'),
(3, 'a537b524-4ed8-437a-87a8-3b443edbd783', 'fcfa0e9d-c2ff-4423-841b-112a707af654', 1, 1, 'Le Jeu Commence', 'Tentés par un prix alléchant en cas de victoire, des centaines de joueurs désargentés acceptent de s\'affronter lors de jeux pour enfants aux enjeux mortels.', 'https://cdn.discordapp.com/attachments/1386226985507885179/1388955539760873584/p20492187_b_h8_aa.png?ex=6864d766&is=686385e6&hm=157bac7f7b37b16c238fe94f4221c426aca47c3d1e1206323e8246cb07835020&', 'https://cdn.discordapp.com/attachments/1386226985507885179/1388896959099834399/SPOILER_Watch_Squid_Game_S01E01_VFF_1080p_WEB_x264_LAZARUS_mp4_The_Ultimate_Free_Video_Hosting_Solution_for.mp4?ex=68693e17&is=6867ec97&hm=7732599822889154c8b9a548ca2a08ded024ec922355b4ed664d709e2d6d73cd&', '57min', 8, '2025-06-30 12:13:32', '2025-07-04 18:08:35');

-- --------------------------------------------------------

--
-- Structure de la table `favorites`
--

CREATE TABLE `favorites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `userId` varchar(50) NOT NULL,
  `videoId` varchar(50) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `addedAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `unique_favorite` (`userId`,`videoId`),
  KEY `userId` (`userId`),
  KEY `videoId` (`videoId`),
  KEY `idx_favorites_user` (`userId`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `read_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `ratings`
--

CREATE TABLE `ratings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `userId` varchar(50) NOT NULL,
  `videoId` varchar(50) NOT NULL,
  `rating` decimal(2,1) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `unique_rating` (`userId`,`videoId`),
  KEY `userId` (`userId`),
  KEY `videoId` (`videoId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `subtitles`
--

CREATE TABLE `subtitles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `videoId` varchar(50) NOT NULL,
  `language` varchar(10) NOT NULL,
  `languageName` varchar(50) NOT NULL,
  `subtitleUrl` varchar(500) NOT NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `videoId` (`videoId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','user') NOT NULL DEFAULT 'user',
  `isFirstLogin` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `uuid`, `username`, `email`, `password`, `role`, `isFirstLogin`, `createdAt`, `updatedAt`) VALUES
(1, '7730af01-ce1a-43e6-90a1-cf6d3535ca6d', 'fragment5685', 'graditoss82@gmail.com', '$2b$12$G0RuH4wOPWwOCr5UCJqYYOKmkpsIkb4r6daulj7/Y2VTsND.ThIne', 'admin', 0, '2025-06-29 18:40:04', '2025-07-04 19:03:32');

-- --------------------------------------------------------

--
-- Structure de la table `videos`
--

CREATE TABLE `videos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `thumbnail` varchar(500) DEFAULT NULL,
  `videoUrl` varchar(500) DEFAULT NULL,
  `duration` varchar(20) DEFAULT NULL,
  `category` text NOT NULL,
  `language` varchar(50) NOT NULL DEFAULT 'Français',
  `year` int(11) NOT NULL,
  `views` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `averageRating` decimal(3,2) NOT NULL DEFAULT 0.00,
  `totalRatings` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `createdBy` varchar(50) NOT NULL,
  `type` enum('movie','series') NOT NULL DEFAULT 'movie',
  `totalSeasons` int(11) DEFAULT 1,
  `totalEpisodes` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `category_idx` (`category`(255)),
  KEY `type_idx` (`type`),
  KEY `year_idx` (`year`),
  KEY `views_idx` (`views`),
  KEY `rating_idx` (`averageRating`),
  KEY `idx_videos_search` (`title`,`description`(100)),
  KEY `idx_videos_category_year` (`category`(100),`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `videos`
--

INSERT INTO `videos` (`id`, `uuid`, `title`, `description`, `thumbnail`, `videoUrl`, `duration`, `category`, `language`, `year`, `views`, `averageRating`, `totalRatings`, `createdAt`, `updatedAt`, `createdBy`, `type`, `totalSeasons`, `totalEpisodes`) VALUES
(1, '3bcf5686-4144-4127-bd49-f9ce82af9095', 'hgcfv', 'hufv', 'https://cdn.discordapp.com/attachments/1391408233280831538/1391408249256808588/image.png?ex=686bc969&is=686a77e9&hm=09950d828089bf139ca0777a2252a34231d4d24216afd52002b0d2a793971fbf&', 'https://cdn.discordapp.com/attachments/1386226985507885179/1388896959099834399/SPOILER_Watch_Squid_Game_S01E01_VFF_1080p_WEB_x264_LAZARUS_mp4_The_Ultimate_Free_Video_Hosting_Solution_for.mp4?ex=686b3857&is=6869e6d7&hm=9ab636a8827632646ab15dca679af882a33ad725a9455094e8c20134ee0f3239&', '15min', 'Action', 'Français', 2025, 18, 0.00, 0, '2025-07-01 15:51:56', '2025-07-06 22:15:02', '2ba88a4a-9612-48c4-8c1f-1ca6dcdee8ad', 'movie', 1, 1),
(2, 'fcfa0e9d-c2ff-4423-841b-112a707af654', 'Squid Game', 'Tentés par un prix alléchant en cas de victoire, des centaines de joueurs désargentés acceptent de s\'affronter lors de jeux pour enfants aux enjeux mortels.', 'https://cdn.discordapp.com/attachments/1386226985507885179/1388955539760873584/p20492187_b_h8_aa.png?ex=6868cbe6&is=68677a66&hm=cf70ebd85dcf56db0dd8cd495f7b2994befe8c4ba3aa502c7297e3c214738dae&', NULL, '', '[\"Action\",\"Comedy\"]', 'Français', 2021, 30, 5.00, 1, '2025-06-30 12:13:32', '2025-07-06 22:49:31', '2ba88a4a-9612-48c4-8c1f-1ca6dcdee8ad', 'series', 3, 3);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `video_stats`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `video_stats` (
`id` int(11)
,`uuid` varchar(50)
,`title` varchar(255)
,`type` enum('movie','series')
,`views` int(10) unsigned
,`averageRating` decimal(3,2)
,`totalRatings` int(10) unsigned
,`favorite_count` bigint(21)
,`watchers_count` bigint(21)
);

-- --------------------------------------------------------

--
-- Structure de la table `watch_history`
--

CREATE TABLE `watch_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(50) NOT NULL,
  `userId` varchar(50) NOT NULL,
  `videoId` varchar(50) NOT NULL,
  `episodeId` varchar(50) DEFAULT NULL,
  `progress` decimal(5,2) NOT NULL DEFAULT 0.00,
  `watchedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `unique_watch` (`userId`,`videoId`,`episodeId`),
  KEY `userId` (`userId`),
  KEY `videoId` (`videoId`),
  KEY `episodeId` (`episodeId`),
  KEY `idx_watch_history_user_date` (`userId`,`watchedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `watch_time`
--

CREATE TABLE `watch_time` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `videoId` varchar(36) NOT NULL,
  `progress` float DEFAULT 0,
  `lastWatched` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `userId` (`userId`),
  KEY `videoId` (`videoId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la vue `video_stats`
--
DROP TABLE IF EXISTS `video_stats`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `video_stats`  AS SELECT `v`.`id` AS `id`, `v`.`uuid` AS `uuid`, `v`.`title` AS `title`, `v`.`type` AS `type`, `v`.`views` AS `views`, `v`.`averageRating` AS `averageRating`, `v`.`totalRatings` AS `totalRatings`, count(distinct `f`.`userId`) AS `favorite_count`, count(distinct `wh`.`userId`) AS `watchers_count` FROM ((`videos` `v` left join `favorites` `f` on(`v`.`uuid` = `f`.`videoId`)) left join `watch_history` `wh` on(`v`.`uuid` = `wh`.`videoId`)) GROUP BY `v`.`id`, `v`.`uuid`, `v`.`title`, `v`.`type`, `v`.`views`, `v`.`averageRating`, `v`.`totalRatings` ;

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT pour la table `email_verification_codes`
--
ALTER TABLE `email_verification_codes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `episodes`
--
ALTER TABLE `episodes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `favorites`
--
ALTER TABLE `favorites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `ratings`
--
ALTER TABLE `ratings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `subtitles`
--
ALTER TABLE `subtitles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `videos`
--
ALTER TABLE `videos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `watch_history`
--
ALTER TABLE `watch_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `watch_time`
--
ALTER TABLE `watch_time`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `episodes`
--
ALTER TABLE `episodes`
  ADD CONSTRAINT `episodes_ibfk_1` FOREIGN KEY (`seriesId`) REFERENCES `videos` (`uuid`) ON DELETE CASCADE;

--
-- Contraintes pour la table `favorites`
--
ALTER TABLE `favorites`
  ADD CONSTRAINT `favorites_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`uuid`) ON DELETE CASCADE,
  ADD CONSTRAINT `favorites_ibfk_2` FOREIGN KEY (`videoId`) REFERENCES `videos` (`uuid`) ON DELETE CASCADE;

--
-- Contraintes pour la table `ratings`
--
ALTER TABLE `ratings`
  ADD CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`uuid`) ON DELETE CASCADE,
  ADD CONSTRAINT `ratings_ibfk_2` FOREIGN KEY (`videoId`) REFERENCES `videos` (`uuid`) ON DELETE CASCADE;

--
-- Contraintes pour la table `subtitles`
--
ALTER TABLE `subtitles`
  ADD CONSTRAINT `subtitles_ibfk_1` FOREIGN KEY (`videoId`) REFERENCES `videos` (`uuid`) ON DELETE CASCADE;

--
-- Contraintes pour la table `watch_history`
--
ALTER TABLE `watch_history`
  ADD CONSTRAINT `watch_history_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`uuid`) ON DELETE CASCADE,
  ADD CONSTRAINT `watch_history_ibfk_2` FOREIGN KEY (`videoId`) REFERENCES `videos` (`uuid`) ON DELETE CASCADE,
  ADD CONSTRAINT `watch_history_ibfk_3` FOREIGN KEY (`episodeId`) REFERENCES `episodes` (`uuid`) ON DELETE CASCADE;

--
-- Contraintes pour la table `watch_time`
--
ALTER TABLE `watch_time`
  ADD CONSTRAINT `watch_time_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`uuid`),
  ADD CONSTRAINT `watch_time_ibfk_2` FOREIGN KEY (`videoId`) REFERENCES `videos` (`uuid`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
