
import { useState, useEffect } from 'react';
import { useVideo } from '../context/VideoContext';
import ModernVideoGrid from '../components/ModernVideoGrid';
import { useDesktopApp } from '../hooks/use-desktop-app';
import { Tv, Star, Calendar, Eye, TrendingUp, Clock, Sparkles } from 'lucide-react';

const Series = () => {
  const { videos } = useVideo();
  const { isDesktopApp } = useDesktopApp();
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeries();
  }, [videos]);

  const loadSeries = () => {
    setLoading(true);
    const seriesList = videos.filter(video => video.type === 'series');
    setSeries(seriesList);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className={`rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto mb-4 ${isDesktopApp ? 'animate-loading-spinner' : 'animate-spin'}`}></div>
          <div className="text-white text-xl">Chargement des séries...</div>
        </div>
      </div>
    );
  }

  const popularSeries = [...series].sort((a, b) => b.views - a.views);
  const recentSeries = [...series].sort((a, b) => b.year - a.year);
  const topRatedSeries = [...series].sort((a, b) => b.averageRating - a.averageRating);

  return (
    <div className="min-h-screen bg-black pt-20">
      <div className="px-4 md:px-16 py-12">
        {/* Hero Section Moderne */}
        <div className="relative mb-16">
          <div className="bg-gradient-to-r from-gray-900/80 via-gray-800/60 to-gray-900/80 rounded-3xl p-12 md:p-16 border border-gray-700/30 backdrop-blur-xl shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-pink-600/5 to-red-600/5 rounded-3xl"></div>
            <div className="relative flex items-center space-x-8">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 via-pink-600 to-red-600 rounded-3xl flex items-center justify-center shadow-xl transform rotate-12">
                <Tv className="w-12 h-12 text-white transform -rotate-12" />
              </div>
              <div>
                <h1 className="text-5xl md:text-7xl text-white font-bold mb-4">
                  Séries
                </h1>
                <p className="text-gray-300 text-xl leading-relaxed mb-6">
                  Plongez dans l'univers captivant de nos séries
                </p>
                <div className="flex items-center space-x-8 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <Tv className="w-4 h-4 text-purple-400" />
                    <span>{series.length} séries disponibles</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span>Episodes en HD</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <span>Nouveaux épisodes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {series.length > 0 ? (
          <div className="space-y-16">
            {/* Séries populaires */}
            <section>
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Séries populaires</h2>
                  <p className="text-gray-400">Binge-watching garanti</p>
                </div>
              </div>
              <ModernVideoGrid
                videos={popularSeries.slice(0, 10)}
                columns={5}
              />
            </section>

            {/* Nouvelles séries */}
            <section>
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Nouvelles séries</h2>
                  <p className="text-gray-400">Les dernières créations originales</p>
                </div>
              </div>
              <ModernVideoGrid
                videos={recentSeries.slice(0, 10)}
                columns={5}
              />
            </section>

            {/* Séries les mieux notées */}
            <section>
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Séries les mieux notées</h2>
                  <p className="text-gray-400">Acclamées par la critique</p>
                </div>
              </div>
              <ModernVideoGrid
                videos={topRatedSeries.slice(0, 10)}
                columns={5}
              />
            </section>
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-2xl rounded-3xl p-20 border border-gray-700/40 shadow-2xl max-w-3xl mx-auto">
              <div className="w-40 h-40 bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
                <Tv className="w-20 h-20 text-gray-500" />
              </div>
              <h2 className="text-4xl text-white font-bold mb-6">Aucune série disponible</h2>
              <p className="text-gray-400 text-xl leading-relaxed">
                Les séries seront bientôt disponibles sur la plateforme
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Series;
