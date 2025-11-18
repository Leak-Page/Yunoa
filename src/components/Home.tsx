
import { useState, useEffect } from 'react';
import { useVideo } from '../context/VideoContext';
import HeroSection from './HeroSection';

import ModernVideoGrid from './ModernVideoGrid';
import { TrendingUp, Star, Clock, Film, Tv, Sparkles, Flame, Award, Zap } from 'lucide-react';

const Home = () => {
  const { videos } = useVideo();
  const [featuredVideo, setFeaturedVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (videos.length > 0) {
      // Sélectionner une vidéo mise en avant aléatoirement
      const randomIndex = Math.floor(Math.random() * Math.min(videos.length, 10));
      setFeaturedVideo(videos[randomIndex]);
      setLoading(false);
    }
  }, [videos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-foreground text-xl font-medium">Chargement du contenu...</div>
        </div>
      </div>
    );
  }

  // Organiser les vidéos par catégories
  const trendingVideos = [...videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  const topRatedVideos = [...videos]
    .filter(v => v.averageRating >= 4)
    .sort((a, b) => b.averageRating - a.averageRating)
    .slice(0, 15);

  const recentVideos = [...videos]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  const seriesVideos = videos.filter(v => v.type === 'series').slice(0, 12);
  const movieVideos = videos.filter(v => v.type !== 'series').slice(0, 12);

  // Organiser par genres populaires
  const genreStats = videos.reduce((acc, video) => {
    acc[video.category] = (acc[video.category] || 0) + video.views;
    return acc;
  }, {} as Record<string, number>);

  const popularGenres = Object.entries(genreStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([genre]) => ({
      name: genre,
      videos: videos.filter(v => v.category === genre).slice(0, 8),
      icon: getGenreIcon(genre)
    }));

  function getGenreIcon(genre: string) {
    const icons: { [key: string]: any } = {
      'Action': Zap,
      'Drama': Award,
      'Comedy': Sparkles,
      'Horror': Flame,
      'Sci-Fi': Star,
      'Romance': Star,
      'Thriller': Flame,
      'Documentary': Film
    };
    return icons[genre] || Film;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Section Hero */}
      <HeroSection featuredVideo={featuredVideo} />

      {/* Contenu principal avec overlay négatif */}
      <div className="relative z-10 -mt-32 space-y-16 pb-24">
        
        {/* Top Trending - Grid moderne */}
        {trendingVideos.length > 0 && (
          <ModernVideoGrid
            videos={trendingVideos}
            title="Tendances actuelles"
            subtitle="Les plus regardés cette semaine"
            columns={5}
            showDescription={true}
          />
        )}

        {/* Top Rated - Grid moderne */}
        {topRatedVideos.length > 0 && (
          <ModernVideoGrid
            videos={topRatedVideos}
            title="Sélection Premium"
            subtitle="Les contenus les mieux notés par notre communauté"
            columns={5}
            showDescription={true}
          />
        )}

        {/* Nouveautés - Grid moderne */}
        {recentVideos.length > 0 && (
          <ModernVideoGrid
            videos={recentVideos}
            title="Nouveautés"
            subtitle="Récemment ajoutés à la plateforme"
            columns={5}
            showDescription={true}
          />
        )}

        {/* Films populaires - Grid moderne 4 colonnes */}
        {movieVideos.length > 0 && (
          <ModernVideoGrid
            videos={movieVideos}
            title="Films incontournables"
            subtitle="Le meilleur du cinéma"
            columns={4}
            showDescription={true}
          />
        )}

        {/* Séries populaires - Grid moderne 3 colonnes */}
        {seriesVideos.length > 0 && (
          <ModernVideoGrid
            videos={seriesVideos}
            title="Séries à binge-watcher"
            subtitle="Les séries que tout le monde regarde"
            columns={3}
            showDescription={true}
          />
        )}

        {/* Sections par genre populaire */}
        {popularGenres.map(({ name, videos: genreVideos, icon: IconComponent }) => (
          genreVideos.length > 0 && (
            <ModernVideoGrid
              key={name}
              videos={genreVideos}
              title={`Sélection ${name}`}
              subtitle={`Explorez le genre ${name.toLowerCase()}`}
              columns={4}
              showDescription={true}
            />
          )
        ))}

        {/* Section découverte - Grid moderne 6 colonnes */}
        <ModernVideoGrid
          videos={videos.slice(0, 24)}
          title="Découvrir plus"
          subtitle="Explorez notre catalogue complet"
          columns={6}
          showDescription={false}
        />

      </div>
    </div>
  );
};

export default Home;
