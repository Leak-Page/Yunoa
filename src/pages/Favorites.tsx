
import { useState, useEffect } from 'react';
import { Heart, Star, Grid } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../context/VideoContext';
import VideoCard from '../components/VideoCard';
import { Link } from 'react-router-dom';

const Favorites = () => {
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
      case 'views':
        return b.views - a.views;
      default: // recent
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  if (!user) {
    return (
      <div className="min-h-screen pt-20 bg-slate-900 flex items-center justify-center">
        <div className="text-center bg-slate-800 p-8 rounded-lg max-w-md">
          <Heart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Accès refusé</h1>
          <p className="text-gray-400 mb-6">Vous devez être connecté pour voir vos favoris</p>
          <Link
            to="/login"
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-3">
            <Heart className="w-8 h-8 text-red-400" />
            <span>Mes Favoris</span>
          </h1>
          <p className="text-gray-400">
            {favoriteVideos.length} vidéo{favoriteVideos.length !== 1 ? 's' : ''} dans vos favoris
          </p>
        </div>

        {/* Statistiques et tri */}
        {favoriteVideos.length > 0 && (
          <div className="mb-8">
            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white">Total</h3>
                <p className="text-2xl font-bold text-red-400">{favoriteVideos.length}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white">Note Moyenne</h3>
                <p className="text-2xl font-bold text-yellow-400">
                  {favoriteVideos.length > 0 
                    ? (favoriteVideos.reduce((sum, video) => sum + video.averageRating, 0) / favoriteVideos.length).toFixed(1)
                    : '0'
                  }⭐
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white">Catégories</h3>
                <p className="text-2xl font-bold text-blue-400">
                  {new Set(favoriteVideos.map(video => video.category)).size}
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white">Total Vues</h3>
                <p className="text-2xl font-bold text-green-400">
                  {favoriteVideos.reduce((sum, video) => sum + video.views, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Options de tri */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Grid className="w-5 h-5 text-gray-400" />
                <span className="text-gray-400 font-medium">Trier par :</span>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none"
              >
                <option value="recent">Plus récent</option>
                <option value="title">Titre A-Z</option>
                <option value="year">Année (récent)</option>
                <option value="rating">Note (élevée)</option>
                <option value="views">Popularité</option>
              </select>
            </div>
          </div>
        )}

        {/* Contenu */}
        {favoriteVideos.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-slate-800 rounded-lg p-8 max-w-md mx-auto">
              <Heart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Aucun favori</h2>
              <p className="text-gray-400 mb-6">
                Ajoutez des vidéos à vos favoris en cliquant sur le cœur
              </p>
              <Link
                to="/"
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Découvrir des vidéos
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Grille de vidéos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {sortedVideos.map((video) => (
                <div key={video.id} className="relative group">
                  <VideoCard video={video} />
                  
                  {/* Badge favori */}
                  <div className="absolute top-2 left-2 bg-red-600 text-white p-2 rounded-full shadow-lg">
                    <Heart className="w-4 h-4 fill-current" />
                  </div>
                </div>
              ))}
            </div>

            {/* Catégories représentées */}
            <div className="mt-12 bg-slate-800 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">Vos catégories préférées</h3>
              <div className="flex flex-wrap gap-3">
                {Array.from(new Set(favoriteVideos.map(video => video.category))).map(category => {
                  const count = favoriteVideos.filter(video => video.category === category).length;
                  
                  return (
                    <div
                      key={category}
                      className="flex items-center space-x-2 bg-slate-700 px-4 py-2 rounded-lg"
                    >
                      <span className="text-white font-medium">{category}</span>
                      <span className="bg-slate-600 text-gray-300 px-2 py-1 rounded text-sm">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Favorites;
