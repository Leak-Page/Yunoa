
import { useState, useEffect } from 'react';
import { apiService } from '../services/ApiService';
import VideoCard from './VideoCard';
import { Star, Trophy } from 'lucide-react';
import { Video } from '../context/VideoContext';

const TopRated = () => {
  const [topVideos, setTopVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopVideos = async () => {
      try {
        const videos = await apiService.getTopRatedVideos(12);
        setTopVideos(videos);
      } catch (error) {
        console.error('Erreur lors de la récupération des vidéos les mieux notées:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopVideos();

    // Refresh every 30 seconds to get updated ratings
    const interval = setInterval(fetchTopVideos, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  if (topVideos.length === 0) {
    return (
      <div className="min-h-screen pt-20 bg-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center space-x-3 mb-8">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Vidéos les mieux notées</h1>
          </div>
          
          <div className="text-center py-12 bg-slate-800 rounded-lg">
            <Star className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Aucune vidéo notée</h2>
            <p className="text-gray-400">Les vidéos apparaîtront ici une fois qu'elles auront reçu des notes.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <h1 className="text-4xl font-bold text-white">Vidéos les mieux notées</h1>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-400">
            Découvrez les {topVideos.length} vidéos avec les meilleures notes de la communauté
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {topVideos.map((video, index) => (
            <div key={video.id} className="relative">
              {index < 3 && (
                <div className="absolute -top-2 -left-2 z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    'bg-orange-600'
                  }`}>
                    {index + 1}
                  </div>
                </div>
              )}
              <VideoCard video={video} />
            </div>
          ))}
        </div>

        {topVideos.length > 0 && (
          <div className="mt-12 bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Statistiques des notes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-1">
                  {topVideos[0]?.averageRating.toFixed(1)}
                </div>
                <div className="text-gray-400">Meilleure note</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-1">
                  {(topVideos.reduce((sum, video) => sum + video.averageRating, 0) / topVideos.length).toFixed(1)}
                </div>
                <div className="text-gray-400">Note moyenne</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">
                  {topVideos.reduce((sum, video) => sum + video.totalRatings, 0)}
                </div>
                <div className="text-gray-400">Total des votes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopRated;
