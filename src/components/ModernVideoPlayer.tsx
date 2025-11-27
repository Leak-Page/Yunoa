import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Heart, Star, Eye, Calendar, User, Film, Settings,
  SkipBack, SkipForward, RotateCcw, Volume1, Plus,
  ThumbsUp, Share2, Download, Loader2, Wifi, WifiOff,
  Settings as SettingsIcon, Monitor
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../context/VideoContext';
import { apiService } from '../services/ApiService';
import { useVideoProtection } from '../utils/videoSecurity';
import { supabase } from '@/integrations/supabase/client';
import SecureDRMPlayer from './SecureDRMPlayer';

const ModernVideoPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const { user, addToFavorites, removeFromFavorites, favorites, addToHistory, rateVideo, getUserRating } = useAuth();
  const { getVideoById, incrementViews, videos } = useVideo();
  
  const [video, setVideo] = useState<any>(null);
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<any>(null);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<any | null>(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  
  // Streaming state
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Other state
  const [showRating, setShowRating] = useState(false);
  const [hasIncrementedViews, setHasIncrementedViews] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [watchHistory, setWatchHistory] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // DRM state
  const [showDRMPlayer, setShowDRMPlayer] = useState(false);
  
  // Get current video URL for streaming
  const currentVideoUrl = currentEpisode ? currentEpisode.video_url : video?.video_url;
  const currentVideoId = currentEpisode ? currentEpisode.id : video?.id;
  
  // Video element ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const loaderRef = useRef<{ cleanup: () => void } | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<Error | null>(null);

  // Security hook
  useVideoProtection(true); // Active la protection anti-inspection

  const isFavorite = video ? favorites.includes(video.id) : false;

  useEffect(() => {
    if (id) {
      loadVideo();
    }
  }, [id]);

  useEffect(() => {
    if (user && video) {
      loadUserRating();
      loadWatchHistory();
      loadSubtitles();
    }
  }, [user, video]);

  // Cleanup loader on unmount
  useEffect(() => {
    return () => {
      if (loaderRef.current) {
        loaderRef.current.cleanup();
      }
    };
  }, []);

  // Auto-save progress every 30 seconds
  useEffect(() => {
    if (!user || !video || !videoRef.current) return;

    const interval = setInterval(() => {
      const videoElement = videoRef.current;
      if (videoElement && videoElement.currentTime > 0) {
        saveWatchProgress();
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [user, video, currentEpisode]);

  // Save progress when video is paused or ends
  useEffect(() => {
    if (!isPlaying && currentTime > 0 && user && video) {
      saveWatchProgress();
    }
  }, [isPlaying, user, video, currentEpisode]);

  const loadVideo = async () => {
    if (!id) return;
    
    try {
      // Utiliser directement apiService.getVideo pour récupérer tous les données, y compris les épisodes
      const videoData = await apiService.getVideo(id);
      setVideo(videoData);
      
      if (videoData) {
        const related = videos
          .filter(v => v.id !== id && v.category === videoData.category)
          .slice(0, 8);
        setRelatedVideos(related);
        
        // Charger la vidéo après avoir récupéré les données
        if (videoRef.current && user) {
          await loadVideoSource(videoData.video_url, videoData.id);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la vidéo:', error);
    }
  };

  const loadVideoSource = async (videoUrl: string, videoId: string) => {
    if (!videoUrl || !videoRef.current || !user) return;

    try {
      setIsLoadingVideo(true);
      setVideoError(null);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }

      const videoElement = videoRef.current;

      // Nettoyer l'ancien loader
      if (loaderRef.current) {
        loaderRef.current.cleanup();
        loaderRef.current = null;
      }

      // Charger via SecureChunkLoader (HLS en priorité)
      const { SecureChunkLoader } = await import('@/utils/secureChunkLoader');
      const loader = new SecureChunkLoader({
        videoUrl,
        videoId,
        sessionToken: token,
        videoElement,
        onProgress: (loaded, total) => {
          const progress = total > 0 ? (loaded / total) * 100 : 0;
          setLoadingProgress(progress);
        },
        onError: (error) => {
          console.error('[ModernVideoPlayer] ❌ Erreur:', error);
          setVideoError(error);
        }
      });

      loaderRef.current = loader;
      const sourceUrl = await loader.load();

      // Pour HLS, la source est déjà définie par HLS.js
      // Pour le fallback, on définit la source manuellement
      if (!videoElement.src || (!videoElement.src.startsWith('blob:') && !videoElement.src.includes('.m3u8'))) {
        videoElement.src = sourceUrl;
        await videoElement.load();
      }

      setIsLoadingVideo(false);

    } catch (error) {
      console.error('[ModernVideoPlayer] ❌ Erreur chargement vidéo:', error);
      setVideoError(error instanceof Error ? error : new Error('Erreur de chargement'));
      setIsLoadingVideo(false);
    }
  };

  const loadUserRating = async () => {
    if (user && video) {
      const rating = await getUserRating(video.id);
      setUserRating(rating);
    }
  };

  const loadSubtitles = async () => {
    if (!video) return;
    
    try {
      const videoId = currentEpisode ? currentEpisode.id : video.id;
      const subtitlesData = await apiService.getSubtitles(videoId);
      setSubtitles(subtitlesData);
      
      // Set default subtitle if available
      const defaultSub = subtitlesData.find((sub: any) => sub.is_default);
      if (defaultSub) {
        setCurrentSubtitle(defaultSub);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des sous-titres:', error);
    }
  };

  const loadWatchHistory = async () => {
    if (!user || !video) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await apiService.getWatchHistory(user.id);
      
      if (response) {
        // Find history for current video/series
        const currentHistory = response.find((item: any) => {
          if (video.type === 'series') {
            // For series, find any episode from this series
            return video.episodes?.some((ep: any) => ep.id === item.video_id);
          } else {
            // For movies, match exact video ID
            return item.video_id === video.id;
          }
        });
        
        setWatchHistory(currentHistory);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveWatchProgress = async () => {
    if (!user || !videoRef.current || !video) return;
    
    const videoElement = videoRef.current;
    const progress = (videoElement.currentTime / videoElement.duration) * 100;
    
    // Don't save if progress is less than 5% or more than 95%
    if (progress < 5 || progress > 95) return;
    
    try {
      const videoId = currentEpisode ? currentEpisode.id : video.id;
      
      await apiService.saveWatchProgress({
        user_id: user.id,
        video_id: videoId,
        episode_id: currentEpisode ? currentEpisode.id : null,
        current_position: Math.floor(videoElement.currentTime),
        progress: progress,
        total_duration: Math.floor(videoElement.duration)
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la progression:', error);
    }
  };

  const resumeFromHistory = () => {
    if (!watchHistory || !videoRef.current) return;
    
    const videoElement = videoRef.current;
    
    if (video.type === 'series' && video.episodes) {
      // For series, find the episode from history
      const historyEpisode = video.episodes.find((ep: any) => ep.id === watchHistory.video_id);
      if (historyEpisode && historyEpisode.id !== currentEpisode?.id) {
        // Switch to the episode from history
        handleEpisodeSelect(historyEpisode);
        // Set time after episode loads
        setTimeout(() => {
          if (videoRef.current && watchHistory.current_position > 0) {
            videoRef.current.currentTime = watchHistory.current_position;
          }
        }, 1000);
      } else {
        // Same episode, just set time
        if (watchHistory.current_position > 0) {
          videoElement.currentTime = watchHistory.current_position;
        }
      }
    } else {
      // For movies, just set time
      if (watchHistory.current_position > 0) {
        videoElement.currentTime = watchHistory.current_position;
      }
    }
  };


  const togglePlay = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleFavoriteToggle = async () => {
    if (!user || !video) return;
    
    if (isFavorite) {
      await removeFromFavorites(video.id);
    } else {
      await addToFavorites(video.id);
    }
  };

  const handleRating = async (rating: number) => {
    if (user && video) {
      await rateVideo(video.id, rating);
      setUserRating(rating);
      setShowRating(false);
      await loadVideo();
    }
  };

  const handleEpisodeSelect = async (episode: any) => {
    setCurrentEpisode(episode);
    console.log('Épisode sélectionné:', episode);
    
    // Load subtitles for the episode
    loadSubtitles();
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!video) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Film className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl text-white font-bold mb-4">Vidéo non trouvée</h1>
          <Link to="/" className="text-red-500 hover:text-red-400">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black" onContextMenu={(e) => e.preventDefault()}>
      {/* Hero Video Section */}
      <div className="relative h-[60vh] overflow-hidden">
        {/* Video Player ou Thumbnail */}
        {videoRef.current && !isLoadingVideo ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              poster={video.thumbnail}
              className="w-full h-full object-cover"
              autoPlay={false}
              controls={false}
              preload="metadata"
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              crossOrigin="anonymous"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                  // Auto-resume from history when video metadata is loaded
                  if (watchHistory && !isLoadingHistory) {
                    if (video.type === 'series') {
                      // For series, check if current episode matches history
                      if (currentEpisode?.id === watchHistory.video_id && watchHistory.current_position > 0) {
                        videoRef.current.currentTime = watchHistory.current_position;
                      }
                    } else {
                      // For movies, resume directly
                      if (watchHistory.current_position > 0) {
                        videoRef.current.currentTime = watchHistory.current_position;
                      }
                    }
                  }
                }
              }}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
                }
              }}
              onEnded={() => setIsPlaying(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Subtitles */}
              {currentSubtitle && (
                <track
                  key={currentSubtitle.id}
                  kind="subtitles"
                  src={currentSubtitle.subtitle_url}
                  srcLang={currentSubtitle.language}
                  label={currentSubtitle.language_name}
                  default={currentSubtitle.is_default}
                />
              )}
            </video>
            
            {/* Loading progress indicator */}
            {loadingProgress > 0 && loadingProgress < 100 && (
              <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black/70 px-3 py-2 rounded-lg">
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-white text-sm">
                  {Math.round(loadingProgress)}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Overlay de chargement */}
        {isLoadingVideo && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold">Chargement de la vidéo...</p>
              {loadingProgress > 0 && (
                <div className="mt-4 w-64 bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erreur de chargement */}
        {videoError && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center text-white">
              <Film className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Erreur de chargement</h3>
              <p className="text-gray-300 mb-4">{videoError.message}</p>
              <button
                onClick={() => {
                  if (video) {
                    loadVideoSource(video.video_url, video.id);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-semibold"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Custom Video Controls */}
        {videoRef.current && !isLoadingVideo && (
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-600 h-1 rounded-full cursor-pointer relative">
                {/* Playback progress */}
                <div 
                  className="absolute bg-red-600 h-1 rounded-full transition-all duration-200 z-10"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-red-400 transition-colors"
                >
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                </button>
                
                {/* Skip Back */}
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                    }
                  }}
                  className="text-white hover:text-red-400 transition-colors"
                >
                  <SkipBack className="w-6 h-6" />
                </button>
                
                {/* Skip Forward */}
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                    }
                  }}
                  className="text-white hover:text-red-400 transition-colors"
                >
                  <SkipForward className="w-6 h-6" />
                </button>
                
                {/* Volume */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const newMuted = !isMuted;
                      setIsMuted(newMuted);
                      if (videoRef.current) {
                        videoRef.current.muted = newMuted;
                      }
                    }}
                    className="text-white hover:text-red-400 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const newVolume = parseFloat(e.target.value);
                      setVolume(newVolume);
                      if (videoRef.current) {
                        videoRef.current.volume = newVolume;
                      }
                      if (newVolume > 0) setIsMuted(false);
                    }}
                    className="w-20 accent-red-600"
                  />
                </div>
                
                {/* Time */}
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Subtitles Menu */}
                {subtitles.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                      className={`px-3 py-1 text-sm text-white border border-white/30 rounded hover:bg-white/10 transition-colors ${currentSubtitle ? 'bg-red-600' : ''}`}
                    >
                      CC
                    </button>
                    {showSubtitleMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg py-2 min-w-[180px] z-50">
                        <button
                          onClick={() => {
                            setCurrentSubtitle(null);
                            setShowSubtitleMenu(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-white hover:bg-white/10 ${!currentSubtitle ? 'bg-red-600' : ''}`}
                        >
                          Désactivés
                        </button>
                        {subtitles.map((subtitle) => (
                          <button
                            key={subtitle.id}
                            onClick={() => {
                              setCurrentSubtitle(subtitle);
                              setShowSubtitleMenu(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-white hover:bg-white/10 ${currentSubtitle?.id === subtitle.id ? 'bg-red-600' : ''}`}
                          >
                            {subtitle.language_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Settings Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-white hover:text-red-400 transition-colors"
                  >
                    <Settings className="w-6 h-6" />
                  </button>
                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg py-2 min-w-[160px] z-50">
                      <div className="px-4 py-2 text-white text-sm font-medium border-b border-white/20">
                        Vitesse de lecture
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => {
                              setPlaybackRate(speed);
                              if (videoRef.current) {
                                videoRef.current.playbackRate = speed;
                              }
                              setShowSettings(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-white hover:bg-white/10 text-sm ${playbackRate === speed ? 'bg-red-600' : ''}`}
                          >
                            {speed === 1 ? 'Normal' : `${speed}x`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Fullscreen */}
                <button
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen();
                      setIsFullscreen(true);
                    } else {
                      document.exitFullscreen();
                      setIsFullscreen(false);
                    }
                  }}
                  className="text-white hover:text-red-400 transition-colors"
                >
                  {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
          <div className="max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              {video.title}
            </h1>
            
            <div className="flex items-center space-x-4 mb-6 text-gray-300">
              <div className="flex items-center space-x-1">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-yellow-400 font-bold">{video.averageRating.toFixed(1)}/5</span>
              </div>
              <span>{video.year}</span>
              <span>{video.duration}</span>
              <span className="border border-gray-400 px-2 py-1 text-xs">
                {video.language.toUpperCase()}
              </span>
            </div>

            <p className="text-lg text-gray-200 mb-8 max-w-2xl">
              {video.description}
            </p>

            <div className="flex items-center space-x-4">
              {/* Resume Button */}
              {watchHistory && watchHistory.progress > 0 && !isLoadingHistory && (
                <button
                  onClick={resumeFromHistory}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded font-semibold transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>
                    Reprendre 
                    {video.type === 'series' && video.episodes ? (
                      ` ${video.episodes.find((ep: any) => ep.id === watchHistory.video_id)?.title || 'l\'épisode'}`
                    ) : (
                      ` à ${formatTime(watchHistory.progress)}`
                    )}
                  </span>
                </button>
              )}
              
              {videoRef.current && !isLoadingVideo ? (
                <button
                  onClick={togglePlay}
                  className="flex items-center space-x-2 bg-white hover:bg-gray-200 text-black px-8 py-3 rounded font-semibold transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Lecture'}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (video) {
                      loadVideoSource(video.video_url, video.id);
                    }
                  }}
                  disabled={isLoadingVideo}
                  className="flex items-center space-x-2 bg-white hover:bg-gray-200 text-black px-8 py-3 rounded font-semibold transition-colors disabled:opacity-50"
                >
                  {isLoadingVideo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                  <span>{isLoadingVideo ? 'Chargement...' : 'Charger la vidéo'}</span>
                </button>
              )}
              
              {/* Bouton DRM Player */}
              <button
                onClick={() => setShowDRMPlayer(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-3 rounded font-semibold transition-all shadow-lg"
              >
                <span className="text-xs">🔐</span>
                <span>Lecture DRM Sécurisée</span>
              </button>
              
              {user && (
                <>
                  <button
                    onClick={handleFavoriteToggle}
                    className={`flex items-center space-x-2 px-8 py-3 rounded font-semibold transition-colors ${
                      isFavorite 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-gray-600/70 hover:bg-gray-600/90 text-white'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    <span>{isFavorite ? 'Retirer de ma liste' : 'Ajouter à ma liste'}</span>
                  </button>

                  <button
                    onClick={() => setShowRating(!showRating)}
                    className="bg-gray-600/70 hover:bg-gray-600/90 text-white px-6 py-3 rounded font-semibold transition-colors"
                  >
                    <ThumbsUp className="w-5 h-5" />
                  </button>
                </>
              )}

              <button className="bg-gray-600/70 hover:bg-gray-600/90 text-white px-6 py-3 rounded font-semibold transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-8 md:px-16 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Rating System */}
            {showRating && user && (
              <div className="bg-slate-800/50 p-6 rounded-xl mb-8">
                <h3 className="text-white font-semibold mb-4">Noter cette vidéo</h3>
                <div className="flex items-center justify-center space-x-2 mb-4">
                  {Array.from({ length: 5 }, (_, index) => {
                    const starValue = index + 1;
                    return (
                      <Star
                        key={index}
                        className={`w-8 h-8 cursor-pointer transition-colors ${
                          userRating && starValue <= userRating
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-400 hover:text-yellow-400'
                        }`}
                        onClick={() => handleRating(starValue)}
                      />
                    );
                  })}
                </div>
                {userRating && (
                  <p className="text-center text-yellow-400">Votre note: {userRating}/5</p>
                )}
              </div>
            )}

            {/* Episodes Section (for series) */}
            {video.type === 'series' && video.episodes && video.episodes.length > 0 && (
              <div className="bg-slate-800/50 p-6 rounded-xl mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Épisodes ({video.episodes.length})</h2>
                  {video.episodes.length > 6 && (
                    <button
                      onClick={() => setShowEpisodeList(!showEpisodeList)}
                      className="text-red-400 hover:text-red-300 font-medium"
                    >
                      {showEpisodeList ? 'Voir moins' : 'Voir tout'}
                    </button>
                  )}
                </div>
                <div className="grid gap-4">
                  {(showEpisodeList ? video.episodes : video.episodes.slice(0, 6))
                    .sort((a: any, b: any) => {
                      if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
                      return a.episodeNumber - b.episodeNumber;
                    })
                    .map((episode: any) => (
                    <div 
                      key={episode.id} 
                      onClick={() => handleEpisodeSelect(episode)}
                      className="flex space-x-4 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/70 transition-colors cursor-pointer group"
                    >
                      <div className="relative">
                        <img
                          src={episode.thumbnail || video.thumbnail}
                          alt={episode.title}
                          className="w-32 h-20 object-cover rounded"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-red-400 font-bold">
                            S{episode.seasonNumber || 1}E{episode.episodeNumber || 1}
                          </span>
                          <h3 className="text-white font-medium group-hover:text-red-400 transition-colors">
                            {episode.title}
                          </h3>
                          <span className="text-gray-400 text-sm">{episode.duration || '45min'}</span>
                        </div>
                        <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                          {episode.description || video.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>{episode.views?.toLocaleString() || '0'} vues</span>
                          </div>
                          <div className="text-xs text-gray-400 group-hover:text-red-400 transition-colors">
                            Cliquer pour regarder
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Details */}
            <div className="bg-slate-800/50 p-6 rounded-xl">
              <h2 className="text-2xl font-bold text-white mb-6">À propos de {video.title}</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-white font-semibold mb-2">Informations</h3>
                    <div className="space-y-2 text-gray-400">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Année: {video.year}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4" />
                        <span>Vues: {video.views.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>Créé par: {video.createdBy}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Genre</h3>
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                      {video.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Vidéos similaires</h2>
            <div className="space-y-4">
              {relatedVideos.map(relatedVideo => (
                <Link
                  key={relatedVideo.id}
                  to={`/info/${relatedVideo.id}`}
                  className="flex space-x-4 p-4 rounded-lg hover:bg-slate-800/50 transition-colors group"
                >
                  <img
                    src={relatedVideo.thumbnail}
                    alt={relatedVideo.title}
                    className="w-32 h-20 object-cover rounded group-hover:scale-105 transition-transform"
                  />
                  <div className="flex-1">
                    <h3 className="text-white font-medium group-hover:text-red-400 transition-colors line-clamp-2 mb-2">
                      {relatedVideo.title}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
                      <span>{relatedVideo.duration}</span>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span>{relatedVideo.averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs">{relatedVideo.views?.toLocaleString()} vues</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* DRM Player Modal */}
      {showDRMPlayer && (
        <SecureDRMPlayer
          videoId={video.id}
          video={video}
          poster={video.thumbnail}
          onClose={() => setShowDRMPlayer(false)}
        />
      )}
    </div>
  );
};

export default ModernVideoPlayer;
