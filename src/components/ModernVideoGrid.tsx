import { useState, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Plus, Star, Info, Clock, Calendar, Eye, ChevronRight, Heart, Bookmark, Share2 } from 'lucide-react';
import { Video } from '../context/VideoContext';
import { useAuth } from '../context/AuthContext';
import { useDesktopApp } from '../hooks/use-desktop-app';
import VideoModal from './VideoModal';

interface ModernVideoGridProps {
  videos: Video[];
  title?: string;
  subtitle?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
  showDescription?: boolean;
  showAnimations?: boolean;
  showProgress?: boolean;
  variant?: 'default' | 'hero' | 'compact' | 'trending';
  showViewCount?: boolean;
  autoPlayPreviews?: boolean;
}

interface VideoCardProps {
  video: Video;
  index: number;
  isHovered: boolean;
  isDesktopApp: boolean;
  isFavorite: boolean;
  user: any;
  variant: 'default' | 'hero' | 'compact' | 'trending';
  showProgress: boolean;
  showViewCount: boolean;
  showAnimations: boolean;
  watchProgress?: number;
  onMouseEnter: (videoId: string) => void;
  onMouseLeave: () => void;
  onClick: (videoId: string) => void;
  onFavoriteToggle: (videoId: string, e: React.MouseEvent) => Promise<void>;
  onInfoClick: (videoId: string, e: React.MouseEvent) => void;
  onShare: (videoId: string, e: React.MouseEvent) => void;
}

const ModernVideoGrid = ({
  videos,
  title,
  subtitle,
  columns = 3,
  showDescription = true,
  showAnimations = true,
  showProgress = true,
  variant = 'default',
  showViewCount = true,
  autoPlayPreviews = false,
}: ModernVideoGridProps) => {
  const { user, favorites, addToFavorites, removeFromFavorites } = useAuth();
  const { isDesktopApp } = useDesktopApp();
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [watchProgress, setWatchProgress] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const gridColsClass = useMemo(() => {
    const gridMap = {
      2: 'grid-cols-1 lg:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5',
      6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
    };
    return gridMap[columns] || gridMap[3];
  }, [columns]);

  const containerClass = useMemo(() => {
    const baseClass = "relative";
    const variantMap = {
      default: "px-6 py-8",
      hero: "px-8 py-12",
      compact: "px-4 py-6",
      trending: "px-6 py-8 bg-gradient-to-b from-background/50 to-background"
    };
    return `${baseClass} ${variantMap[variant]}`;
  }, [variant]);

  // Load watch progress for all videos
  useEffect(() => {
    if (user && videos.length > 0) {
      // Simulate loading watch progress - in real app, this would come from API
      const progress: Record<string, number> = {};
      videos.forEach(video => {
        progress[video.id] = Math.random() * 0.8; // Random progress for demo
      });
      setWatchProgress(progress);
    }
  }, [user, videos]);

  const handleFavoriteToggle = useCallback(
    async (videoId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user) return;

      try {
        if (favorites.includes(videoId)) {
          await removeFromFavorites(videoId);
        } else {
          await addToFavorites(videoId);
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    },
    [user, favorites, addToFavorites, removeFromFavorites]
  );

  const handleShare = useCallback(
    async (videoId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Regarder ${videos.find(v => v.id === videoId)?.title}`,
            url: `${window.location.origin}/video/${videoId}`
          });
        } catch (error) {
          console.log('Share cancelled');
        }
      } else {
        // Fallback - copy to clipboard
        navigator.clipboard.writeText(`${window.location.origin}/video/${videoId}`);
      }
    },
    [videos]
  );

  const handleVideoInfo = useCallback(
    (videoId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedVideoId(videoId);
      setIsModalOpen(true);
    },
    []
  );

  const handleVideoClick = useCallback(
    (videoId: string) => {
      setSelectedVideoId(videoId);
      setIsModalOpen(true);
    },
    []
  );

  const handleMouseEnter = useCallback((videoId: string) => {
    if (!isDesktopApp) {
      setHoveredVideo(videoId);
    }
  }, [isDesktopApp]);

  const handleMouseLeave = useCallback(() => {
    if (!isDesktopApp) {
      setHoveredVideo(null);
    }
  }, [isDesktopApp]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedVideoId(null);
  }, []);

  if (!videos.length) {
    return (
      <div className={containerClass}>
        <div className="flex items-center justify-center py-20">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center animate-pulse">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Aucun contenu disponible</h3>
            <p className="text-muted-foreground">Revenez plus tard pour découvrir de nouveaux contenus.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* En-tête moderne avec animations améliorées */}
      {title && (
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="overflow-hidden">
              <h2 className={`font-bold text-foreground mb-2 animate-slide-up ${
                variant === 'hero' ? 'text-5xl' : 'text-3xl lg:text-4xl'
              }`} style={{ animationDelay: '0.1s' }}>
                {title}
              </h2>
              {subtitle && (
                <p className="text-muted-foreground text-base lg:text-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  {subtitle}
                </p>
              )}
            </div>
            {variant === 'trending' && (
              <div className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 cursor-pointer animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <span>Voir tout</span>
                <ChevronRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            )}
          </div>
          
          {/* Ligne décorative animée */}
          <div className="relative w-20 h-1 bg-gradient-to-r from-primary to-primary/50 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>
      )}

      {/* Grille de vidéos avec animations en cascade */}
      <div className={`grid ${gridColsClass} gap-3 sm:gap-4 md:gap-6 ${showAnimations ? 'animate-stagger-in' : ''}`}>
        {videos.map((video, index) => (
          <VideoCard
            key={video.id}
            video={video}
            index={index}
            variant={variant}
            showProgress={showProgress}
            showViewCount={showViewCount}
            showAnimations={showAnimations}
            watchProgress={watchProgress[video.id]}
            isHovered={hoveredVideo === video.id}
            isDesktopApp={isDesktopApp}
            isFavorite={favorites.includes(video.id)}
            user={user}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleVideoClick}
            onFavoriteToggle={handleFavoriteToggle}
            onInfoClick={handleVideoInfo}
            onShare={handleShare}
          />
        ))}
      </div>

      {/* Modal de détail */}
      {selectedVideoId && (
        <VideoModal
          videoId={selectedVideoId}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

const VideoCard = ({
  video,
  index,
  variant,
  showProgress,
  showViewCount,
  showAnimations,
  watchProgress,
  isHovered,
  isDesktopApp,
  isFavorite,
  user,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onFavoriteToggle,
  onInfoClick,
  onShare,
}: VideoCardProps) => {
  const cardSize = variant === 'hero' ? 'aspect-[16/10]' : 'aspect-video';
  const cardStyle = variant === 'compact' ? 'rounded-md' : 'rounded-xl';
  
  return (
    <div
      className={`group cursor-pointer transform transition-all duration-500 ease-out ${
        showAnimations ? `animate-scale-in opacity-0` : ''
      } ${isHovered && !isDesktopApp ? 'scale-105 z-10 -translate-y-2' : 'hover:scale-[1.02]'} hover:z-20`}
      style={{ 
        animationDelay: `${index * 100}ms`,
        animationFillMode: 'forwards'
      }}
      onMouseEnter={() => onMouseEnter(video.id)}
      onMouseLeave={onMouseLeave}
      onClick={() => onClick(video.id)}
    >
      {/* Conteneur principal avec effet de glow au hover */}
      <div className={`relative ${cardSize} bg-card ${cardStyle} overflow-hidden transition-all duration-500 ${
        isHovered ? 'shadow-2xl shadow-primary/20' : 'shadow-lg hover:shadow-xl'
      }`}>
        
        {/* Image de thumbnail avec effet parallax amélioré */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={video.thumbnail || '/placeholder.svg'}
            alt={video.title}
            className={`w-full h-full object-cover transition-all duration-700 ease-out ${
              isHovered ? 'scale-110 brightness-110' : 'scale-100'
            }`}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          
          {/* Effet de brillance au hover */}
          <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-all duration-700 ${
            isHovered ? 'translate-x-full' : '-translate-x-full'
          }`} style={{ animationDelay: '0.2s' }} />
        </div>
        
        {/* Gradient overlay amélioré */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-all duration-500 ${
          isHovered ? 'from-black/95 via-black/50 to-black/20' : ''
        }`} />
        
        {/* Overlay avec blur animé au hover */}
        <div 
          className={`absolute inset-0 backdrop-blur-sm bg-black/30 transition-all duration-700 ease-out ${
            isHovered ? 'opacity-100 backdrop-blur-md bg-black/50' : 'opacity-0'
          }`}
          style={{ 
            maskImage: isHovered ? 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 85%)' : undefined
          }}
        />

        {/* Badges animés en haut */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
          {/* Rating avec animation */}
          <div className="flex flex-col gap-2">
            <div className={`bg-black/80 backdrop-blur-md text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-white/20 transition-all duration-300 ${
              isHovered ? 'scale-105 bg-black/90 shadow-lg' : ''
            }`}>
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 transition-transform duration-300" />
              <span className="font-medium">{video.averageRating?.toFixed(1) || '0.0'}</span>
            </div>
            
            {/* Indicateur de nouveauté animé */}
            {(() => {
              const videoDate = new Date(video.createdAt);
              const twoWeeksAgo = new Date();
              twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
              return videoDate > twoWeeksAgo;
            })() && (
              <div className={`bg-green-500/90 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md font-medium transition-all duration-300 ${
                isHovered ? 'animate-bounce-in scale-105' : ''
              }`}>
                NOUVEAU
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 items-end">
            {/* Type de contenu avec animation */}
            <div className={`text-white text-xs px-2.5 py-1.5 rounded-lg font-medium backdrop-blur-md border border-white/20 transition-all duration-300 ${
              video.type === 'series' 
                ? 'bg-blue-600/90 hover:bg-blue-500/95' 
                : 'bg-orange-600/90 hover:bg-orange-500/95'
            } ${isHovered ? 'scale-105 shadow-lg' : ''}`}>
              {video.type === 'series' ? 'SÉRIE' : 'FILM'}
            </div>

            {/* Nombre de vues avec animation */}
            {showViewCount && video.views && (
              <div className={`bg-black/80 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-white/10 transition-all duration-300 ${
                isHovered ? 'scale-105 bg-black/90' : ''
              }`}>
                <Eye className="w-3 h-3 transition-transform duration-300" />
                <span>{video.views.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Informations séries - toujours visibles avec animation */}
        {video.type === 'series' && (video.totalSeasons || video.totalEpisodes) && (
          <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-20">
            <div className={`bg-black/95 backdrop-blur-lg text-white text-xs px-3 py-1.5 rounded-full border border-white/30 shadow-lg transition-all duration-300 ${
              isHovered ? 'scale-105 bg-black/100 shadow-xl' : ''
            }`}>
              {video.totalSeasons && `${video.totalSeasons} saison${video.totalSeasons > 1 ? 's' : ''}`}
              {video.totalSeasons && video.totalEpisodes && ' • '}
              {video.totalEpisodes && `${video.totalEpisodes} épisodes`}
            </div>
          </div>
        )}



        {/* Contrôles au hover avec animations en cascade */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 z-30 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center max-w-full px-4">
            {/* Bouton Play principal avec animation bounce */}
            <Link
              to={`/video/${video.id}`}
              className={`bg-white/95 backdrop-blur-lg text-black p-3 sm:p-4 rounded-full transition-all duration-300 shadow-2xl border border-white/30 ${
                isHovered ? 'animate-bounce-in scale-110 hover:scale-125' : ''
              } hover:bg-white hover:shadow-white/25`}
              onClick={(e) => e.stopPropagation()}
              style={{ animationDelay: '0.1s' }}
            >
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current transition-transform duration-200" />
            </Link>

            {/* Actions utilisateur avec animations décalées */}
            {user && (
              <>
                {/* Favoris */}
                <button
                  onClick={(e) => onFavoriteToggle(video.id, e)}
                  className={`p-2.5 sm:p-3 rounded-full transition-all duration-300 backdrop-blur-lg border border-white/40 shadow-lg ${
                    isHovered ? 'animate-bounce-in' : ''
                  } ${
                    isFavorite
                      ? 'bg-pink-500/95 text-white shadow-pink-500/30 hover:shadow-pink-500/40'
                      : 'bg-black/80 text-white hover:bg-pink-500/95 hover:scale-110 hover:shadow-pink-500/30'
                  }`}
                  style={{ animationDelay: '0.2s' }}
                >
                  <Heart className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 ${isFavorite ? 'fill-current scale-110' : ''}`} />
                </button>


              </>
            )}

            {/* Partager */}
            <button
              onClick={(e) => onShare(video.id, e)}
              className={`bg-black/80 backdrop-blur-lg text-white p-2.5 sm:p-3 rounded-full transition-all duration-300 border border-white/40 shadow-lg hover:bg-green-500/95 hover:scale-110 hover:shadow-green-500/30 ${
                isHovered ? 'animate-bounce-in' : ''
              }`}
              style={{ animationDelay: '0.4s' }}
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300" />
            </button>

            {/* Info */}
            <button
              onClick={(e) => onInfoClick(video.id, e)}
              className={`bg-black/80 backdrop-blur-lg text-white p-2.5 sm:p-3 rounded-full transition-all duration-300 border border-white/40 shadow-lg hover:bg-purple-500/95 hover:scale-110 hover:shadow-purple-500/30 ${
                isHovered ? 'animate-bounce-in' : ''
              }`}
              style={{ animationDelay: '0.5s' }}
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Informations textuelles avec animations */}
      <div className="mt-4 space-y-2">
        <h3 className={`text-foreground font-semibold text-sm lg:text-base line-clamp-2 leading-tight transition-colors duration-300 ${
          isHovered ? 'text-primary' : ''
        }`}>
          {video.title}
        </h3>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* Année avec icon animée */}
            <div className="flex items-center gap-1 group">
              <Calendar className={`w-3 h-3 transition-transform duration-300 ${isHovered ? 'rotate-12' : ''}`} />
              <span className="transition-colors duration-300">{video.year}</span>
            </div>
            
            {/* Durée avec icon animée */}
            {video.duration && (
              <div className="flex items-center gap-1 group">
                <Clock className={`w-3 h-3 transition-transform duration-300 ${isHovered ? 'rotate-12' : ''}`} />
                <span className="transition-colors duration-300">{video.duration}</span>
              </div>
            )}
          </div>
          
          {/* Catégorie avec animation */}
          {video.category && (
            <span className={`bg-muted px-2 py-1 rounded-md text-xs font-medium transition-all duration-300 ${
              isHovered ? 'bg-primary/20 text-primary scale-105' : ''
            }`}>
              {video.category}
            </span>
          )}
        </div>

        {/* Description courte au hover avec animation */}
        {isHovered && video.description && variant !== 'compact' && (
          <div className="overflow-hidden">
            <p className="text-muted-foreground text-xs line-clamp-3 leading-relaxed animate-slide-up">
              {video.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernVideoGrid;
