-- Créer quelques catégories de test
INSERT INTO public.categories (name, description, color) VALUES
('Action', 'Films et séries d''action', '#ff6b6b'),
('Comédie', 'Contenus humoristiques', '#4ecdc4'),
('Drame', 'Histoires dramatiques', '#45b7d1'),
('Science-Fiction', 'Films de science-fiction', '#96ceb4'),
('Horreur', 'Films d''horreur', '#feca57');

-- Créer quelques vidéos de test
INSERT INTO public.videos (title, description, thumbnail, video_url, duration, category, language, year, views, average_rating, total_ratings, type, created_by) VALUES
('Film d''Action Épique', 'Un film d''action palpitant avec des cascades incroyables', 'https://images.unsplash.com/photo-1489599511618-b4ffecb1c8e0?w=800&h=450&fit=crop', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', '2h 15min', 'Action', 'fr', 2023, 15420, 4.2, 89, 'movie', (SELECT id FROM profiles LIMIT 1)),
('Comédie Familiale', 'Une comédie drôle pour toute la famille', 'https://images.unsplash.com/photo-1489599511618-b4ffecb1c8e0?w=800&h=450&fit=crop', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', '1h 45min', 'Comédie', 'fr', 2023, 8930, 3.8, 56, 'movie', (SELECT id FROM profiles LIMIT 1)),
('Drame Psychologique', 'Un drame intense qui vous marquera', 'https://images.unsplash.com/photo-1489599511618-b4ffecb1c8e0?w=800&h=450&fit=crop', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', '2h 30min', 'Drame', 'fr', 2023, 12340, 4.5, 134, 'movie', (SELECT id FROM profiles LIMIT 1)),
('Série Sci-Fi', 'Une série de science-fiction captivante', 'https://images.unsplash.com/photo-1489599511618-b4ffecb1c8e0?w=800&h=450&fit=crop', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', '45min/épisode', 'Science-Fiction', 'fr', 2023, 25670, 4.7, 203, 'series', (SELECT id FROM profiles LIMIT 1)),
('Thriller Surnaturel', 'Un thriller qui vous donnera des frissons', 'https://images.unsplash.com/photo-1489599511618-b4ffecb1c8e0?w=800&h=450&fit=crop', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', '1h 58min', 'Horreur', 'fr', 2023, 18450, 4.1, 78, 'movie', (SELECT id FROM profiles LIMIT 1));