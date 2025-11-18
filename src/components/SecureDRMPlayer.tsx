import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, SkipBack, SkipForward, Fullscreen, RotateCcw,
  Volume1, Shield, Eye, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import VideoControls from './VideoControls';

interface SecureDRMPlayerProps {
  videoId: string;
  video: any;
  hlsManifestUrl?: string;
  poster?: string;
  onClose?: () => void;
}

const SecureDRMPlayer: React.FC<SecureDRMPlayerProps> = ({
  videoId,
  video,
  hlsManifestUrl,
  poster,
  onClose
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // DRM state
  const [drmSession, setDrmSession] = useState<any>(null);
  const [keyRotationInterval, setKeyRotationInterval] = useState<NodeJS.Timeout | null>(null);
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 10, y: 10 });
  const [isProtected, setIsProtected] = useState(true);
  const [violations, setViolations] = useState(0);

  // Protection contre les outils de développement
  useEffect(() => {
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        handleSecurityViolation('DEV_TOOLS_DETECTED');
      }
    };

    const disableRightClick = (e: MouseEvent) => {
      e.preventDefault();
      handleSecurityViolation('RIGHT_CLICK_ATTEMPT');
      return false;
    };

    const disableKeyShortcuts = (e: KeyboardEvent) => {
      // Bloquer F12, Ctrl+Shift+I, Ctrl+U, etc.
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J')
      ) {
        e.preventDefault();
        handleSecurityViolation('KEYBOARD_SHORTCUT_BLOCKED');
        return false;
      }
    };

    const disableSelection = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const disableDragDrop = (e: DragEvent) => {
      e.preventDefault();
      handleSecurityViolation('DRAG_DROP_ATTEMPT');
      return false;
    };

    // Event listeners
    document.addEventListener('contextmenu', disableRightClick);
    document.addEventListener('keydown', disableKeyShortcuts);
    document.addEventListener('selectstart', disableSelection);
    document.addEventListener('dragstart', disableDragDrop);
    
    // Vérification périodique des outils de développement
    const devToolsCheck = setInterval(detectDevTools, 1000);

    return () => {
      document.removeEventListener('contextmenu', disableRightClick);
      document.removeEventListener('keydown', disableKeyShortcuts);
      document.removeEventListener('selectstart', disableSelection);
      document.removeEventListener('dragstart', disableDragDrop);
      clearInterval(devToolsCheck);
    };
  }, []);

  // Watermark dynamique qui bouge
  useEffect(() => {
    const moveWatermark = () => {
      if (containerRef.current && watermarkRef.current) {
        const container = containerRef.current.getBoundingClientRect();
        const watermark = watermarkRef.current.getBoundingClientRect();
        
        const maxX = container.width - watermark.width - 20;
        const maxY = container.height - watermark.height - 20;
        
        setWatermarkPosition({
          x: Math.random() * maxX,
          y: Math.random() * maxY
        });
      }
    };

    const watermarkTimer = setInterval(moveWatermark, 30000); // Bouge toutes les 30 secondes
    return () => clearInterval(watermarkTimer);
  }, []);

  // Initialiser DRM et HLS
  useEffect(() => {
    if (user && videoId) {
      initializeDRMSession();
    }
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (keyRotationInterval) {
        clearInterval(keyRotationInterval);
      }
    };
  }, [user, videoId]);

  const initializeDRMSession = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token d\'authentification requis');
      }

      // Créer une session DRM
      const response = await fetch('/api/videos/drm/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création de la session DRM');
      }

      const session = await response.json();
      setDrmSession(session);

      console.log('🔐 Session DRM initialisée:', {
        sessionId: session.sessionId,
        keysCount: session.keys.length,
        expiresIn: session.expiresIn
      });

      // Initialiser HLS avec DRM
      if (hlsManifestUrl) {
        initializeHLS(session);
      }

      // Configurer la rotation des clés
      setupKeyRotation(session.keyRotationInterval);

      toast({
        title: "🔒 Protection DRM Activée",
        description: "Lecture sécurisée initialisée avec succès"
      });

    } catch (error) {
      console.error('Erreur DRM:', error);
      toast({
        title: "Erreur de sécurité",
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: "destructive"
      });
    }
  };

  const initializeHLS = (session: any) => {
    if (!videoRef.current || !Hls.isSupported()) {
      console.error('HLS non supporté');
      return;
    }

    const hls = new Hls({
      debug: false,
      enableWorker: true,
      lowLatencyMode: false,
      xhrSetup: (xhr: XMLHttpRequest, url: string) => {
        // Ajouter l'authentification pour les requêtes de clés
        if (url.includes('/api/videos/drm/key')) {
          const token = localStorage.getItem('token');
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
      }
    });

    // Gestion des erreurs DRM
    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('Erreur HLS:', data);
      
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        if (data.details === Hls.ErrorDetails.KEY_LOAD_ERROR) {
          handleSecurityViolation('DRM_KEY_ERROR');
        }
      }
      
      if (data.fatal) {
        handleFatalError(data);
      }
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('📺 Manifest HLS chargé avec succès');
      setIsBuffering(false);
    });

    hls.on(Hls.Events.FRAG_LOADING, () => {
      setIsBuffering(true);
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      setIsBuffering(false);
    });

    // Charger le stream
    hls.loadSource(hlsManifestUrl!);
    hls.attachMedia(videoRef.current);
    hlsRef.current = hls;
  };

  const setupKeyRotation = (intervalSeconds: number) => {
    const interval = setInterval(() => {
      console.log('🔄 Rotation des clés DRM...');
      // Ici on pourrait déclencher une nouvelle session ou rotation de clés
    }, intervalSeconds * 1000);
    
    setKeyRotationInterval(interval);
  };

  const handleSecurityViolation = useCallback((violationType: string) => {
    setViolations(prev => prev + 1);
    
    console.warn(`⚠️ Violation de sécurité détectée: ${violationType}`);
    
    // Après 3 violations, arrêter la lecture
    if (violations >= 2) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      
      toast({
        title: "🚨 Sécurité Compromise",
        description: "Lecture interrompue pour cause de violations de sécurité",
        variant: "destructive"
      });
      
      if (onClose) {
        onClose();
      }
    } else {
      toast({
        title: "⚠️ Avertissement de Sécurité",
        description: `Tentative de contournement détectée (${violations + 1}/3)`,
        variant: "destructive"
      });
    }
  }, [violations, onClose, toast]);

  const handleFatalError = (data: any) => {
    console.error('Erreur fatale HLS:', data);
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    
    toast({
      title: "Erreur de lecture",
      description: "Impossible de lire la vidéo sécurisée",
      variant: "destructive"
    });
  };

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise) {
        playPromise.catch(error => {
          console.error('Erreur lecture:', error);
        });
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
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

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Accès Restreint</h3>
          <p>Authentification requise pour accéder au contenu protégé</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      onMouseMove={() => setShowControls(true)}
    >
      {/* Watermark dynamique */}
      <div
        ref={watermarkRef}
        className="absolute z-40 pointer-events-none opacity-30 text-white/60 text-sm font-mono bg-black/20 px-2 py-1 rounded transition-all duration-1000"
        style={{
          left: `${watermarkPosition.x}px`,
          top: `${watermarkPosition.y}px`,
          transform: 'rotate(-15deg)'
        }}
      >
        {user.email} | ID: {user.id.slice(-8)} | {new Date().toLocaleTimeString()}
      </div>

      {/* Indicateur de protection DRM */}
      {isProtected && (
        <div className="absolute top-4 right-4 z-40 flex items-center space-x-2 bg-green-600/80 text-white px-3 py-1 rounded-full text-xs">
          <Shield className="w-4 h-4" />
          <span>DRM Protégé</span>
        </div>
      )}

      {/* Violations counter */}
      {violations > 0 && (
        <div className="absolute top-4 left-4 z-40 flex items-center space-x-2 bg-red-600/80 text-white px-3 py-1 rounded-full text-xs">
          <AlertTriangle className="w-4 h-4" />
          <span>Violations: {violations}/3</span>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onVolumeChange={() => {
          if (videoRef.current) {
            setVolume(videoRef.current.volume);
            setIsMuted(videoRef.current.muted);
          }
        }}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        crossOrigin="anonymous"
        preload="metadata"
      />

      {/* Loading overlay */}
      {isBuffering && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
            <p className="text-lg">Chargement sécurisé...</p>
          </div>
        </div>
      )}

      {/* Contrôles personnalisés */}
      <VideoControls
        videoRef={videoRef}
        isPlaying={isPlaying}
        isMuted={isMuted}
        progress={progress}
        volume={volume}
        currentTime={currentTime}
        duration={duration}
        isFullscreen={isFullscreen}
        showControls={showControls}
        playbackRate={playbackRate}
        subtitles={[]}
        selectedSubtitle={null}
        title={video.title}
        video={video}
        onTogglePlay={togglePlay}
        onToggleMute={() => {
          if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
          }
        }}
        onVolumeChange={(newVolume) => {
          if (videoRef.current) {
            videoRef.current.volume = newVolume;
          }
        }}
        onProgressChange={(newProgress) => {
          if (videoRef.current) {
            const time = (newProgress / 100) * videoRef.current.duration;
            videoRef.current.currentTime = time;
          }
        }}
        onToggleFullscreen={toggleFullscreen}
        onPlaybackRateChange={(rate) => {
          if (videoRef.current) {
            videoRef.current.playbackRate = rate;
            setPlaybackRate(rate);
          }
        }}
        onSubtitleChange={() => {}}
        onSkipTime={(seconds) => {
          if (videoRef.current) {
            videoRef.current.currentTime += seconds;
          }
        }}
        onGoBack={onClose}
      />

      {/* Protection overlay invisible pour bloquer l'inspection */}
      <div 
        className="absolute inset-0 pointer-events-none z-50"
        style={{ 
          background: 'transparent',
          mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
};

export default SecureDRMPlayer;