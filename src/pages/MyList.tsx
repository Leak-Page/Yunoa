
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../context/VideoContext';
import VideoCard from '../components/VideoCard';
import { Heart, Filter, Play, TrendingUp, Star, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const MyList = () => {
  const { user, favorites } = useAuth();
  const { videos } = useVideo();
  const [favoriteVideos, setFavoriteVideos] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    if (user && favorites.length > 0) {
      const favVideos = videos.filter(video => favorites.includes(video.id));
      setFavoriteVideos(favVideos);
    } else {
      setFavoriteVideos([]);
    }
  }, [user, favorites, videos]);

  const sortedVideos = [...favoriteVideos].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'year':
        return b.year - a.year;
      case 'rating':
        return b.averageRating - a.averageRating;
      default: // recent
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-br from-gray-900/90 via-gray-800/80 to-gray-900/90 backdrop-blur-xl rounded-3xl p-12 border border-gray-700/50 shadow-2xl max-w-md">
            <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Connectez-vous</h1>
            <p className="text-gray-400 mb-8 leading-relaxed">Vous devez être connecté pour accéder à votre liste personnalisée</p>
            <Link
              to="/login"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg inline-flex items-center space-x-2"
            >
              <Play className="w-5 h-5" />
              <span>Se connecter</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 px-4 md:px-16">
      {/* Hero Section */}
      <div className="relative mb-12">
        <div className="bg-gradient-to-r from-red-900/40 via-red-800/30 to-transparent rounded-3xl p-8 md:p-12 border border-gray-800/50 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center shadow-xl">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-6xl text-white font-bold mb-2">Ma liste</h1>
                <p className="text-gray-300 text-lg">
                  {favoriteVideos.length} titre{favoriteVideos.length > 1 ? 's' : ''} dans votre collection
                </p>
              </div>
            </div>
            
            {favoriteVideos.length > 0 && (
              <div className="flex items-center space-x-3">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 text-white rounded-xl px-6 py-3 focus:border-red-500 focus:outline-none transition-colors hover:border-gray-600"
                >
                  <option value="recent">Plus récent</option>
                  <option value="title">Titre A-Z</option>
                  <option value="year">Année</option>
                  <option value="rating">Note</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {favoriteVideos.length > 0 ? (
        <>
          {/* Enhanced Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 hover:border-red-500/30 transition-all duration-300 hover:scale-105 group">
              <div className="flex items-center justify-between mb-4">
                <Heart className="w-8 h-8 text-red-500 group-hover:scale-110 transition-transform" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{favoriteVideos.length}</p>
                  <p className="text-sm text-gray-400">Total</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 hover:border-yellow-500/30 transition-all duration-300 hover:scale-105 group">
              <div className="flex items-center justify-between mb-4">
                <Star className="w-8 h-8 text-yellow-400 group-hover:scale-110 transition-transform" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">
                    {(favoriteVideos.reduce((sum, video) => sum + video.averageRating, 0) / favoriteVideos.length).toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-400">Note moyenne</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 hover:border-blue-500/30 transition-all duration-300 hover:scale-105 group">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-blue-400 group-hover:scale-110 transition-transform" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">
                    {new Set(favoriteVideos.map(video => Array.isArray(video.category) ? video.category[0] : video.category)).size}
                  </p>
                  <p className="text-sm text-gray-400">Catégories</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 hover:border-green-500/30 transition-all duration-300 hover:scale-105 group">
              <div className="flex items-center justify-between mb-4">
                <Calendar className="w-8 h-8 text-green-400 group-hover:scale-110 transition-transform" />
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">
                    {favoriteVideos.reduce((sum, video) => sum + video.views, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-400">Vues totales</p>
                </div>
              </div>
            </div>
          </div>

          {/* Videos Grid - Modern Style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
            {sortedVideos.map(video => (
              <div key={video.id} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border border-gray-800/50 hover:border-red-500/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/10">
                <VideoCard video={video} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <div className="bg-gradient-to-br from-gray-900/90 via-gray-800/80 to-gray-900/90 backdrop-blur-xl rounded-3xl p-16 border border-gray-800/50 shadow-2xl max-w-2xl mx-auto">
            <div className="w-32 h-32 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
              <Heart className="w-16 h-16 text-gray-500" />
            </div>
            <h2 className="text-3xl text-white font-bold mb-6">Votre liste est vide</h2>
            <p className="text-gray-400 text-lg mb-10 leading-relaxed max-w-md mx-auto">
              Découvrez des contenus incroyables et ajoutez-les à votre liste pour les retrouver facilement.
            </p>
            <Link
              to="/"
              className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg inline-flex items-center space-x-3"
            >
              <Play className="w-6 h-6" />
              <span>Découvrir du contenu</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyList;
