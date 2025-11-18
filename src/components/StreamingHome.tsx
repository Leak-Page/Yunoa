import { useState, useEffect } from 'react';
import { useVideo, Video } from '../context/VideoContext';
import { useDesktopApp } from '../hooks/use-desktop-app';
import HeroSection from './HeroSection';
import ModernVideoGrid from './ModernVideoGrid';

const StreamingHome = () => {
  const { videos } = useVideo();
  const { isDesktopApp } = useDesktopApp();
  const [featuredVideo, setFeaturedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (videos.length > 0) {
      // Sélectionner une vidéo en vedette aléatoirement parmi les mieux notées
      const topVideos = videos
        .filter(video => video.averageRating >= 4)
        .sort((a, b) => b.averageRating - a.averageRating);
      
      if (topVideos.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(topVideos.length, 5));
        setFeaturedVideo(topVideos[randomIndex]);
      } else {
        setFeaturedVideo(videos[0]);
      }
      
      setLoading(false);
    }
  }, [videos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className={`rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto mb-4 ${isDesktopApp ? 'animate-loading-spinner' : 'animate-spin'}`}></div>
          <div className="text-white text-xl">Chargement...</div>
        </div>
      </div>
    );
  }

  // Trier et organiser les vidéos
  const trendingVideos = [...videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  const topRatedVideos = [...videos]
    .sort((a, b) => b.averageRating - a.averageRating)
    .slice(0, 20);

  const recentVideos = [...videos]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  const seriesVideos = videos.filter(video => video.type === 'series');
  const movieVideos = videos.filter(video => video.type === 'movie');

  // Grouper par genre pour les sections par catégorie
  const categories = Array.from(new Set(videos.flatMap(video => 
    Array.isArray(video.category) ? video.category : [video.category]
  )));

  const genreVideos = categories.map(genre => ({
    genre,
    videos: videos.filter(video => 
      Array.isArray(video.category) 
        ? video.category.includes(genre)
        : video.category === genre
    ).slice(0, 15)
  })).filter(({ videos }) => videos.length >= 5);

  return (
    <div className="min-h-screen bg-black">
      {/* Section héro */}
      <HeroSection featuredVideo={featuredVideo} />

      {/* Grilles modernes */}
      <div className="relative -mt-32 z-20 space-y-4">
        <ModernVideoGrid
          title="Tendances actuelles"
          videos={trendingVideos.slice(0, 10)}
          columns={5}
        />

        <ModernVideoGrid
          title="Top 10 dans votre région"
          videos={topRatedVideos.slice(0, 10)}
          columns={5}
        />

        <ModernVideoGrid
          title="Nouveautés"
          videos={recentVideos.slice(0, 10)}
          columns={5}
        />

        <ModernVideoGrid
          title="Reprendre le visionnage"
          videos={videos.slice(0, 10)}
          columns={5}
        />

        {seriesVideos.length > 0 && (
          <ModernVideoGrid
            title="Séries populaires"
            videos={seriesVideos.slice(0, 10)}
            columns={5}
          />
        )}

        {movieVideos.length > 0 && (
          <ModernVideoGrid
            title="Films populaires"
            videos={movieVideos.slice(0, 10)}
            columns={5}
          />
        )}

        <ModernVideoGrid
          title="Sélection Yunoa"
          videos={topRatedVideos.slice(0, 10)}
          columns={5}
        />

        {/* Grilles par genre */}
        {genreVideos.map(({ genre, videos: genreVids }) => (
          genreVids.length > 0 && (
            <ModernVideoGrid
              key={genre}
              title={genre}
              videos={genreVids.slice(0, 10)}
              columns={5}
            />
          )
        ))}

        <ModernVideoGrid
          title="Parce que vous avez regardé..."
          videos={videos.slice(5, 15)}
          columns={5}
        />
      </div>
    </div>
  );
};

export default StreamingHome;