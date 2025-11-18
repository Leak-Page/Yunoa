
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Heart, Eye, Star } from 'lucide-react';
import { Video } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

interface VideoCardProps {
  video: Video;
}

const VideoCard = ({ video }: VideoCardProps) => {
  const { user, addToFavorites, removeFromFavorites, favorites, rateVideo, getUserRating } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);

  const isFavorite = favorites.includes(video.id);

  useEffect(() => {
    if (user) {
      loadUserRating();
    }
  }, [user, video.id]);

  const loadUserRating = async () => {
    if (user) {
      const rating = await getUserRating(video.id);
      setUserRating(rating);
    }
  };

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) return;
    
    if (isFavorite) {
      removeFromFavorites(video.id);
    } else {
      addToFavorites(video.id);
    }
  };

  const handleRating = async (rating: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user) {
      await rateVideo(video.id, rating);
      setUserRating(rating);
      setShowRating(false);
    }
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M vues`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K vues`;
    }
    return `${views} vues`;
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => {
      const starValue = index + 1;
      return (
        <Star
          key={index}
          className={`w-4 h-4 cursor-pointer transition-colors ${
            userRating && starValue <= userRating
              ? 'text-yellow-400 fill-current'
              : starValue <= Math.round(video.average_rating)
              ? 'text-yellow-400 fill-current'
              : 'text-gray-400'
          }`}
          onClick={(e) => user && handleRating(starValue, e)}
        />
      );
    });
  };

  return (
    <div 
      className="group relative bg-slate-800 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowRating(false);
      }}
    >
      <Link to={`/video/${video.id}`} className="block">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-slate-700">
          {!imageError ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-700">
              <Play className="w-12 h-12 text-slate-500" />
            </div>
          )}
          
          {/* Overlay avec boutons */}
          <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center space-x-4">
              <button className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-colors">
                <Play className="w-6 h-6 ml-1" />
              </button>
              
              {user && (
                <>
                  <button
                    onClick={handleFavoriteToggle}
                    className={`p-3 rounded-full transition-colors ${
                      isFavorite 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowRating(!showRating);
                    }}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white p-3 rounded-full transition-colors"
                  >
                    <Star className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Système de notation */}
          {showRating && user && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-lg p-3">
              <div className="flex items-center justify-center space-x-1">
                {renderStars()}
              </div>
              <p className="text-white text-xs text-center mt-1">Cliquez pour noter</p>
            </div>
          )}

          {/* Durée */}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {video.duration}
          </div>

          {/* Note moyenne */}
          <div className="absolute top-2 left-2 bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold flex items-center space-x-1">
            <Star className="w-3 h-3 fill-current" />
            <span>{video.average_rating.toFixed(1)}</span>
          </div>

          {/* Langue */}
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
            {video.language}
          </div>
        </div>

        {/* Informations */}
        <div className="p-4">
          <h3 className="text-white font-semibold text-lg mb-2 line-clamp-1">
            {video.title}
          </h3>
          
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">
            {video.description}
          </p>
          
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span className="bg-slate-700 px-2 py-1 rounded text-xs">
              {video.category}
            </span>
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{formatViews(video.views)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">{video.year}</span>
            {userRating && (
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-yellow-400 text-sm">{userRating}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default VideoCard;
