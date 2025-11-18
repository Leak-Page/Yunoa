
import { useState, useEffect } from 'react';
import { User, Settings, Heart, History, Star, Eye, Clock, Calendar, Award, Tv, Film } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/ApiService';

interface UserStats {
  totalWatched: number;
  totalFavorites: number;
  totalRatings: number;
  totalHours: number;
}

interface UserActivity {
  type: 'watch' | 'favorite' | 'rate';
  date: string;
  videoId: string;
  title: string;
  thumbnail: string;
  category: string;
  averageRating: number;
  videoType: string;
  userRating?: number;
}

const Profile = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalWatched: 0,
    totalFavorites: 0,
    totalRatings: 0,
    totalHours: 0
  });
  const [recentActivities, setRecentActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const [userStats, userActivity] = await Promise.all([
        apiService.getUserStats(user.id),
        apiService.getUserActivity(user.id, 10)
      ]);
      
      setStats(userStats);
      setRecentActivities(userActivity);
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityDescription = (activity: UserActivity) => {
    switch (activity.type) {
      case 'watch':
        return `Regardé "${activity.title}"`;
      case 'favorite':
        return `Ajouté "${activity.title}" aux favoris`;
      case 'rate':
        return `Noté "${activity.title}" ${activity.userRating || 5} étoiles`;
      default:
        return `Interagi avec "${activity.title}"`;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'watch': return { icon: Eye, color: 'text-blue-400' };
      case 'favorite': return { icon: Heart, color: 'text-red-400' };
      case 'rate': return { icon: Star, color: 'text-yellow-400' };
      default: return { icon: Award, color: 'text-green-400' };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      return `Il y a ${Math.floor(diffInMinutes / 60)}h`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    }
  };

  const formatCategory = (category: string) => {
    try {
      const parsed = JSON.parse(category);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
      return category;
    } catch {
      return category;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-white font-bold mb-4">Accès non autorisé</h1>
          <p className="text-gray-400">Veuillez vous connecter pour voir votre profil</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête du profil moderne */}
        <div className="relative mb-12">
          <div className="bg-gradient-to-r from-gray-900/90 via-gray-800/80 to-gray-900/90 rounded-3xl p-8 md:p-12 border border-gray-700/30 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 via-purple-600/5 to-pink-600/10 rounded-3xl"></div>
            <div className="relative flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
              <div className="w-32 h-32 bg-gradient-to-br from-red-600 via-pink-600 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                <User className="w-16 h-16 text-white" />
              </div>
              <div className="text-center md:text-left flex-1">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {user.username}
                </h1>
                <p className="text-gray-300 text-lg mb-4">{user.email}</p>
                <p className="text-gray-400">Membre depuis {new Date(user.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
              </div>
              <button className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-6 py-3 rounded-2xl transition-all transform hover:scale-105 flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Modifier le profil</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Statistiques réelles */}
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                <Award className="w-4 h-4 text-white" />
              </div>
              <span>Statistiques</span>
            </h2>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-6 border border-gray-700/30 backdrop-blur-sm">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{isLoading ? '...' : stats.totalWatched}</h3>
                    <p className="text-gray-400">Vidéos regardées</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-6 border border-gray-700/30 backdrop-blur-sm">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-pink-600 rounded-xl flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{isLoading ? '...' : stats.totalFavorites}</h3>
                    <p className="text-gray-400">Favoris</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-6 border border-gray-700/30 backdrop-blur-sm">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{isLoading ? '...' : stats.totalRatings}</h3>
                    <p className="text-gray-400">Notes données</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-6 border border-gray-700/30 backdrop-blur-sm">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{isLoading ? '...' : `${stats.totalHours}h`}</h3>
                    <p className="text-gray-400">Temps de visionnage</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Activités récentes réelles */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <History className="w-4 h-4 text-white" />
              </div>
              <span>Activité récente</span>
            </h2>
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl border border-gray-700/30 backdrop-blur-sm overflow-hidden">
              {recentActivities.length > 0 ? (
                <div className="divide-y divide-gray-700/50">
                  {recentActivities.map((activity, index) => {
                    const activityConfig = getActivityIcon(activity.type);
                    return (
                      <div key={`${activity.videoId}-${activity.type}-${index}`} className="p-6 hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 bg-gray-800/60 rounded-xl flex items-center justify-center ${activityConfig.color}`}>
                            <activityConfig.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium">{getActivityDescription(activity)}</p>
                            <div className="flex items-center space-x-3 text-sm text-gray-400 mt-1">
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatTimeAgo(activity.date)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                {activity.videoType === 'series' ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                                <span>{formatCategory(activity.category)}</span>
                              </span>
                               <span className="flex items-center space-x-1">
                                <Star className="w-3 h-3 text-yellow-400" />
                                <span>{activity.averageRating?.toFixed(1) || 'N/A'}</span>
                               </span>
                            </div>
                          </div>
                          <img
                            src={activity.thumbnail}
                            alt={activity.title}
                            className="w-16 h-10 object-cover rounded-lg"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <History className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {isLoading ? 'Chargement...' : 'Aucune activité récente'}
                  </h3>
                  <p className="text-gray-400">
                    {isLoading ? 'Récupération de vos données...' : 'Vos activités récentes apparaîtront ici'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
