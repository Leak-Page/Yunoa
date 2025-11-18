
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../services/SupabaseService';
import { Clock, Play, Star, Calendar, Trash2, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

const History = () => {
  const { user } = useAuth();
  const [watchHistory, setWatchHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    if (user) {
      loadWatchHistory();
    }
  }, [user]);

  useEffect(() => {
    filterAndSortHistory();
  }, [watchHistory, filterBy, sortBy]);

  const loadWatchHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const history = await supabaseService.getWatchHistory(user.id);
      setWatchHistory(history);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortHistory = () => {
    let filtered = [...watchHistory];

    // Filter
    if (filterBy !== 'all') {
      filtered = filtered.filter((item: any) => {
        if (filterBy === 'completed') return item.progress >= 0.9;
        if (filterBy === 'in-progress') return item.progress > 0 && item.progress < 0.9;
        if (filterBy === 'series') return item.type === 'series';
        if (filterBy === 'movies') return item.type === 'movie';
        return true;
      });
    }

    // Sort
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime();
        case 'oldest':
          return new Date(a.lastWatched).getTime() - new Date(b.lastWatched).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'progress':
          return b.progress - a.progress;
        default:
          return 0;
      }
    });

    setFilteredHistory(filtered);
  };

  const clearHistory = async () => {
    if (!user || !confirm('Êtes-vous sûr de vouloir effacer tout votre historique ?')) return;
    
    try {
      // Clear from Supabase
      const { error } = await supabaseService.supabase
        .from('watch_history')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setWatchHistory([]);
      setFilteredHistory([]);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'historique:', error);
    }
  };

  const removeFromHistory = async (itemId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabaseService.supabase
        .from('watch_history')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      const updatedHistory = watchHistory.filter((item: any) => item.id !== itemId);
      setWatchHistory(updatedHistory);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'élément:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Veuillez vous connecter pour voir votre historique</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Historique</h1>
            <p className="text-gray-400">Vos vidéos récemment regardées</p>
          </div>
          
          {watchHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Tout effacer</span>
            </button>
          )}
        </div>

        {watchHistory.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-8 p-6 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-white font-medium">Filtrer:</span>
            </div>
            
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">Tout</option>
              <option value="completed">Terminés</option>
              <option value="in-progress">En cours</option>
              <option value="series">Séries</option>
              <option value="movies">Films</option>
            </select>

            <div className="flex items-center space-x-2">
              <span className="text-white font-medium">Trier par:</span>
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="recent">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="title">Titre (A-Z)</option>
              <option value="progress">Progression</option>
            </select>

            <span className="text-gray-400 ml-auto">
              {filteredHistory.length} résultat{filteredHistory.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {filteredHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHistory.map((item: any) => (
              <div key={item.id} className="group relative bg-gray-900/50 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:scale-105">
                <div className="relative">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                    <div 
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${(item.progress || 0) * 100}%` }}
                    />
                  </div>
                  
                  {/* Play Button */}
                  <Link
                    to={`/video/${item.videoId}`}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"
                  >
                    <div className="bg-white/90 rounded-full p-4 hover:bg-white transition-colors">
                      <Play className="w-6 h-6 text-black fill-current" />
                    </div>
                  </Link>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromHistory(item.id)}
                    className="absolute top-3 right-3 bg-black/70 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="p-6">
                  <h3 className="text-white font-semibold text-lg mb-2 line-clamp-1">
                    {item.title}
                  </h3>
                  
                  {item.episodeTitle && (
                    <p className="text-gray-400 text-sm mb-2">
                      S{item.seasonNumber}E{item.episodeNumber} - {item.episodeTitle}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(item.lastWatched).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span>{item.rating || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                      {item.type === 'series' ? 'Série' : 'Film'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {Math.round((item.progress || 0) * 100)}% regardé
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Clock className="w-20 h-20 text-gray-600 mx-auto mb-6" />
            <h2 className="text-2xl text-white font-semibold mb-2">
              {filterBy === 'all' ? 'Aucun historique' : 'Aucun résultat'}
            </h2>
            <p className="text-gray-400 mb-6">
              {filterBy === 'all' 
                ? 'Commencez à regarder du contenu pour voir votre historique ici'
                : 'Essayez de changer les filtres pour voir plus de résultats'
              }
            </p>
            {filterBy !== 'all' && (
              <button
                onClick={() => setFilterBy('all')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Voir tout l'historique
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
