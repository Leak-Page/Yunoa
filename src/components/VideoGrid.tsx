
import { useState } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Star, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Video } from '../services/SupabaseService';
import { useAuth } from '../context/AuthContext';

interface VideoGridProps {
  videos: Video[];
  title?: string;
}

const VideoGrid = ({ videos, title }: VideoGridProps) => {
  const { user, favorites, addToFavorites, removeFromFavorites } = useAuth();
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

  const handleFavoriteToggle = async (videoId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) return;
    
    if (favorites.includes(videoId)) {
      await removeFromFavorites(videoId);
    } else {
      await addToFavorites(videoId);
    }
  };

  return (
    <div className="mb-12">
      {title && (
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 px-4 md:px-16">
          {title}
        </h2>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4 md:px-16">
        {videos.map((video) => (
          <Link
            key={video.id}
            to={`/info/${video.id}`}
            className="group relative"
            onMouseEnter={() => setHoveredVideo(video.id)}
            onMouseLeave={() => setHoveredVideo(null)}
          >
            <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-slate-800 transition-all duration-300 group-hover:scale-110 group-hover:z-50">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Overlay on hover */}
              <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
                hoveredVideo === video.id ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white font-bold text-sm mb-2 line-clamp-2 break-words">
                    {video.title}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1 text-yellow-400">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs font-medium">{video.average_rating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-300">
                      <Eye className="w-3 h-3" />
                      <span className="text-xs">{video.views.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button className="bg-white text-black p-2 rounded-full hover:bg-gray-200 transition-colors">
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                      
                      {user && (
                        <button
                          onClick={(e) => handleFavoriteToggle(video.id, e)}
                          className={`p-2 rounded-full transition-colors ${
                            favorites.includes(video.id)
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-700 text-white hover:bg-slate-600'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                      
                      <button className="bg-slate-700 text-white p-2 rounded-full hover:bg-slate-600 transition-colors">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <button className="bg-slate-700 text-white p-2 rounded-full hover:bg-slate-600 transition-colors">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Rating badge */}
              <div className="absolute top-2 left-2 bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold flex items-center space-x-1">
                <Star className="w-3 h-3 fill-current" />
                <span>{video.average_rating.toFixed(1)}</span>
              </div>

              {/* Duration */}
              <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {video.duration}
              </div>

              {/* Category */}
              <div className="absolute bottom-2 left-2 bg-slate-800/90 text-white text-xs px-2 py-1 rounded">
                {video.category}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default VideoGrid;
