import { useState, useEffect } from 'react';
import { X, Play, Plus, ThumbsUp, Share2, Star, Calendar, Eye, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../context/VideoContext';
import { useToast } from '../hooks/use-toast';
import { apiService } from '../services/ApiService';
import { Link, useNavigate } from 'react-router-dom';

interface NetflixModalProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
}

const NetflixModal = ({ videoId, isOpen, onClose }: NetflixModalProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, addToFavorites, removeFromFavorites, favorites, rateVideo, getUserRating } = useAuth();
  const { getVideoById, incrementViews, videos } = useVideo();
  
  const [video, setVideo] = useState<any>(null);
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [showRating, setShowRating] = useState(false);

  const isFavorite = video ? favorites.includes(video.id) : false;

  useEffect(() => {
    if (isOpen && videoId) {
      loadVideo();
    }
  }, [isOpen, videoId]);

  useEffect(() => {
    if (user && video) {
      loadUserRating();
    }
  }, [user, video]);

  const loadVideo = async () => {
    setLoading(true);
    const videoData = await getVideoById(videoId);
    setVideo(videoData);
    
    if (videoData) {
      const related = videos
        .filter(v => v.id !== videoId && v.category === videoData.category)
        .slice(0, 6);
      setRelatedVideos(related);
      
      // Load episodes if it's a series
      if (videoData.type === 'series') {
        try {
          const episodesData = await apiService.getEpisodes(videoId);
          setEpisodes(episodesData);
        } catch (error) {
          console.error('Error loading episodes:', error);
          setEpisodes([]);
        }
      }
    }
    setLoading(false);
  };

  const loadUserRating = async () => {
    if (user && video) {
      const rating = await getUserRating(video.id);
      setUserRating(rating);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user || !video) return;
    
    try {
      if (isFavorite) {
        await removeFromFavorites(video.id);
        toast({
          title: "Retiré des favoris",
          description: `${video.title} a été retiré de votre liste.`,
        });
      } else {
        await addToFavorites(video.id);
        toast({
          title: "Ajouté aux favoris",
          description: `${video.title} a été ajouté à votre liste.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const handleRating = async (rating: number) => {
    if (user && video) {
      try {
        await rateVideo(video.id, rating);
        setUserRating(rating);
        setShowRating(false);
        await loadVideo();
        toast({
          title: "Note enregistrée",
          description: `Vous avez noté ${video.title} : ${rating}/5 étoiles.`,
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Une erreur est survenue lors de la notation.",
          variant: "destructive",
        });
      }
    }
  };

  const handlePlayVideo = () => {
    navigate(`/video/${video.id}`);
    onClose();
  };

  const handlePlayEpisode = (episodeId: string) => {
    navigate(`/video/${episodeId}`);
    onClose();
  };

  const handleLikeVideo = async () => {
    if (!user || !video) return;
    
    try {
      // Simuler un like - vous pouvez implémenter votre logique de like ici
      toast({
        title: "J'aime ajouté",
        description: `Vous aimez ${video.title}`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const handleShareVideo = async () => {
    if (!video) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: video.description,
          url: window.location.origin + `/video/${video.id}`
        });
      } else {
        // Fallback - copier dans le presse-papiers
        await navigator.clipboard.writeText(window.location.origin + `/video/${video.id}`);
        toast({
          title: "Lien copié",
          description: "Le lien de la vidéo a été copié dans le presse-papiers.",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de partager la vidéo.",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!video) return null;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-black/80 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-800/50 shadow-2xl backdrop-blur-lg"
           style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(20,20,20,0.95) 100%)' }}>
        
        {/* Header with video preview */}
        <div className="relative h-80 lg:h-96">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-all hover:scale-110 backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Play button and controls */}
          <div className="absolute bottom-8 left-8 right-8">
            <h2 className="text-white text-4xl lg:text-5xl font-bold mb-6 drop-shadow-2xl">{video.title}</h2>
            
            <div className="flex items-center space-x-3 mb-6">
              <button 
                onClick={handlePlayVideo}
                className="bg-white hover:bg-gray-200 text-black px-8 py-3 rounded-lg font-bold transition-all flex items-center space-x-2 hover:scale-105 shadow-lg"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Lecture</span>
              </button>
              
              {user && (
                <button
                  onClick={handleFavoriteToggle}
                  className={`p-3 rounded-full border-2 transition-all hover:scale-110 ${
                    isFavorite 
                      ? 'bg-red-600 text-white border-red-600' 
                      : 'bg-black/50 text-white border-white/30 hover:border-white backdrop-blur-sm'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
              
              <button 
                onClick={handleLikeVideo}
                className="bg-black/50 text-white border-2 border-white/30 hover:border-white rounded-full p-3 transition-all hover:scale-110 backdrop-blur-sm"
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              
              <button 
                onClick={handleShareVideo}
                className="bg-black/50 text-white border-2 border-white/30 hover:border-white rounded-full p-3 transition-all hover:scale-110 backdrop-blur-sm"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center space-x-4 text-gray-300 drop-shadow-lg">
              <div className="flex items-center space-x-1 bg-black/30 rounded-lg px-3 py-1 backdrop-blur-sm">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-yellow-400 font-bold">{video.averageRating.toFixed(1)}/5</span>
              </div>
              <span className="bg-black/30 rounded-lg px-3 py-1 backdrop-blur-sm">{video.year}</span>
              <span className="bg-black/30 rounded-lg px-3 py-1 backdrop-blur-sm">{video.duration}</span>
              <span className="border border-white/30 bg-black/30 rounded-lg px-3 py-1 text-xs backdrop-blur-sm">
                {video.language?.toUpperCase() || 'FR'}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 max-h-96 overflow-y-auto bg-gradient-to-b from-black/80 to-black/95">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main content */}
            <div className="lg:col-span-2">
              <p className="text-gray-300 mb-8 leading-relaxed text-lg">
                {video.description}
              </p>
              
              {/* Episodes section for series */}
              {video.type === 'series' && (
                <div className="mb-8">
                  <h3 className="text-white text-2xl font-bold mb-6">Épisodes</h3>
                  <div className="space-y-4">
                    {episodes.length > 0 ? (
                      episodes.slice(0, 6).map((episode) => (
                        <div 
                          key={episode.id} 
                          onClick={() => handlePlayEpisode(episode.id)}
                          className="group flex space-x-4 p-4 bg-gray-900/50 rounded-xl hover:bg-gray-800/70 transition-all cursor-pointer border border-gray-800/30 hover:border-red-500/30"
                        >
                          <div className="relative">
                            <img
                              src={episode.thumbnail || video.thumbnail}
                              alt={episode.title}
                              className="w-32 h-20 object-cover rounded-lg group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Play className="w-6 h-6 text-white fill-current" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-red-500 font-bold text-lg">
                                {episode.episodeNumber}.
                              </span>
                              <h4 className="text-white font-semibold text-lg group-hover:text-red-400 transition-colors">
                                {episode.title}
                              </h4>
                              <span className="text-gray-400 text-sm bg-gray-800/50 px-2 py-1 rounded">{episode.duration || '45min'}</span>
                            </div>
                            <p className="text-gray-300 text-sm line-clamp-2 group-hover:text-gray-200 transition-colors">
                              {episode.description || `Épisode ${episode.episodeNumber} de ${video.title}`}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-center py-8 bg-gray-900/30 rounded-xl border border-gray-800/30">
                        Aucun épisode disponible
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Rating section */}
              {user && (
                <div className="mb-8">
                  <button
                    onClick={() => setShowRating(!showRating)}
                    className="text-white hover:text-yellow-400 transition-colors flex items-center space-x-2 bg-gray-900/50 rounded-lg px-4 py-3 border border-gray-800/30 hover:border-yellow-400/30"
                  >
                    <Star className="w-5 h-5" />
                    <span className="font-medium">Noter cette vidéo</span>
                  </button>
                  
                  {showRating && (
                    <div className="mt-6 p-6 bg-gray-900/70 rounded-xl border border-gray-800/50 backdrop-blur-sm">
                      <h4 className="text-white font-semibold mb-4 text-center">Quelle note donnez-vous ?</h4>
                      <div className="flex items-center justify-center space-x-3 mb-6">
                        {Array.from({ length: 5 }, (_, index) => {
                          const starValue = index + 1;
                          return (
                            <Star
                              key={index}
                              className={`w-10 h-10 cursor-pointer transition-all hover:scale-110 ${
                                userRating && starValue <= userRating
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-500 hover:text-yellow-400'
                              }`}
                              onClick={() => handleRating(starValue)}
                            />
                          );
                        })}
                      </div>
                      {userRating && (
                        <p className="text-center text-yellow-400 font-medium">Votre note: {userRating}/5 ⭐</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div>
              <div className="space-y-6">
                <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800/30">
                  <h4 className="text-white font-bold mb-4 text-lg">Informations</h4>
                  <div className="space-y-3 text-gray-300">
                    <div className="flex items-center space-x-3 p-2 bg-gray-800/30 rounded-lg">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      <span>Année: <strong className="text-white">{video.year}</strong></span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 bg-gray-800/30 rounded-lg">
                      <Eye className="w-5 h-5 text-green-400" />
                      <span>Vues: <strong className="text-white">{video.views.toLocaleString()}</strong></span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 bg-gray-800/30 rounded-lg">
                      <User className="w-5 h-5 text-purple-400" />
                      <span>Créé par: <strong className="text-white">{video.createdBy || 'Utilisateur'}</strong></span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800/30">
                  <h4 className="text-white font-bold mb-4 text-lg">Genre</h4>
                  <span className="bg-gradient-to-r from-red-600 to-red-800 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                    {video.category}
                  </span>
                </div>
              </div>
              
              {/* Related videos */}
              {relatedVideos.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-white font-bold mb-4 text-lg">Vidéos similaires</h4>
                  <div className="space-y-4">
                    {relatedVideos.slice(0, 3).map((relatedVideo) => (
                      <div 
                        key={relatedVideo.id} 
                        className="group flex space-x-3 cursor-pointer hover:bg-gray-800/30 p-3 rounded-xl transition-all border border-gray-800/30 hover:border-red-500/30"
                        onClick={() => {
                          navigate(`/video/${relatedVideo.id}`);
                          onClose();
                        }}
                      >
                        <div className="relative">
                          <img
                            src={relatedVideo.thumbnail}
                            alt={relatedVideo.title}
                            className="w-20 h-14 object-cover rounded-lg group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Play className="w-4 h-4 text-white fill-current" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h5 className="text-white text-sm font-medium line-clamp-2 mb-2 group-hover:text-red-400 transition-colors">
                            {relatedVideo.title}
                          </h5>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            <span>{relatedVideo.averageRating.toFixed(1)}</span>
                            <span>•</span>
                            <span>{relatedVideo.year}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetflixModal;