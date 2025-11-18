
import { useState, useEffect } from 'react';
import { useVideo } from '../context/VideoContext';
import VideoCard from './VideoCard';
import { Filter, Grid } from 'lucide-react';

const Categories = () => {
  const { videos, categories, refreshData } = useVideo();
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    refreshData();
  }, []);

  // Filtrer les vidéos par catégorie sélectionnée
  const filteredVideos = selectedCategory 
    ? videos.filter(video => video.category === selectedCategory)
    : videos;

  return (
    <div className="min-h-screen pt-20 bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4 flex items-center space-x-3">
            <Grid className="w-8 h-8" />
            <span>Catégories</span>
          </h1>
          <p className="text-gray-400">Explorez notre collection par genre</p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white">Total Vidéos</h3>
            <p className="text-2xl font-bold text-red-400">{videos.length}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white">Catégories</h3>
            <p className="text-2xl font-bold text-red-400">{categories.length}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white">Total Vues</h3>
            <p className="text-2xl font-bold text-red-400">
              {videos.reduce((sum, video) => sum + (video.views || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white">Mieux Noté</h3>
            <p className="text-2xl font-bold text-red-400">
              {videos.length > 0 ? Math.max(...videos.map(v => v.averageRating || 0)).toFixed(1) : '0.0'}⭐
            </p>
          </div>
        </div>

        {/* Filtres par catégorie */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 font-medium">Filtrer par genre :</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-6 py-3 rounded-full text-sm font-medium transition-all ${
                selectedCategory === ''
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              Tous ({videos.length})
            </button>
            {categories.map((category) => {
              const count = videos.filter(v => v.category === category).length;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-3 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-red-600 text-white shadow-lg'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {category} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Grille de vidéos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>

        {/* Message si aucun résultat */}
        {filteredVideos.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-slate-800 rounded-lg p-8 max-w-md mx-auto">
              <Grid className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Aucun contenu trouvé pour cette catégorie</p>
              <button
                onClick={() => setSelectedCategory('')}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Voir tout le contenu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;
