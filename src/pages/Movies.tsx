
import { useState, useEffect } from 'react';
import { useVideo } from '../context/VideoContext';
import ModernVideoGrid from '../components/ModernVideoGrid';
import { useDesktopApp } from '../hooks/use-desktop-app';
import { Film, Star, Calendar, Eye, TrendingUp, Clock, Sparkles } from 'lucide-react';

const Movies = () => {
  const { videos } = useVideo();
  const { isDesktopApp } = useDesktopApp();
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovies();
  }, [videos]);

  const loadMovies = () => {
    setLoading(true);
    const movieList = videos.filter(video => video.type === 'movie');
    setMovies(movieList);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className={`rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto mb-4 ${isDesktopApp ? 'animate-loading-spinner' : 'animate-spin'}`}></div>
          <div className="text-white text-xl">Chargement des films...</div>
        </div>
      </div>
    );
  }

  const popularMovies = [...movies].sort((a, b) => b.views - a.views);
  const recentMovies = [...movies].sort((a, b) => b.year - a.year);
  const topRatedMovies = [...movies].sort((a, b) => b.averageRating - a.averageRating);

  return (
    <div className="min-h-screen bg-black pt-20">
      <div className="px-4 md:px-16 py-12">
        {/* Hero Section Moderne */}
        <div className="relative mb-16">
          <div className="bg-gradient-to-r from-gray-900/80 via-gray-800/60 to-gray-900/80 rounded-3xl p-12 md:p-16 border border-gray-700/30 backdrop-blur-xl shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5 rounded-3xl"></div>
            <div className="relative flex items-center space-x-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-xl transform rotate-12">
                <Film className="w-12 h-12 text-white transform -rotate-12" />
              </div>
              <div>
                <h1 className="text-5xl md:text-7xl text-white font-bold mb-4">
                  Films
                </h1>
                <p className="text-gray-300 text-xl leading-relaxed mb-6">
                  Découvrez le meilleur du cinéma mondial
                </p>
                <div className="flex items-center space-x-8 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <Film className="w-4 h-4 text-blue-400" />
                    <span>{movies.length} films disponibles</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span>Qualité Premium</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Nouveautés régulières</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {movies.length > 0 ? (
          <div className="space-y-16">
            {/* Films populaires */}
            <section>
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Films populaires</h2>
                  <p className="text-gray-400">Les plus regardés en ce moment</p>
                </div>
              </div>
              <ModernVideoGrid
                videos={popularMovies.slice(0, 10)}
                columns={5}
              />
            </section>

            {/* Nouveaux films */}
            <section>
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Nouveaux films</h2>
                  <p className="text-gray-400">Les dernières sorties cinéma</p>
                </div>
              </div>
              <ModernVideoGrid
                videos={recentMovies.slice(0, 10)}
                columns={5}
              />
            </section>

            {/* Films les mieux notés */}
            <section>
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Films les mieux notés</h2>
                  <p className="text-gray-400">Sélection de la critique</p>
                </div>
              </div>
              <ModernVideoGrid
                videos={topRatedMovies.slice(0, 10)}
                columns={5}
              />
            </section>
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-2xl rounded-3xl p-20 border border-gray-700/40 shadow-2xl max-w-3xl mx-auto">
              <div className="w-40 h-40 bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
                <Film className="w-20 h-20 text-gray-500" />
              </div>
              <h2 className="text-4xl text-white font-bold mb-6">Aucun film disponible</h2>
              <p className="text-gray-400 text-xl leading-relaxed">
                Les films seront bientôt disponibles sur la plateforme
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Movies;
