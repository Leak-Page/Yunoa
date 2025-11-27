"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Settings,
  SkipBack,
  SkipForward,
  Heart,
  List,
  X,
  Star,
  ArrowLeft,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useVideo } from "../context/VideoContext"
import { useToast } from "../hooks/use-toast"
import { useWatchHistory } from "../hooks/useWatchHistory"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VideoSecurityManager } from "@/utils/videoSecurity"

// Custom Slider Component avec corrections d'alignement
const VideoSlider = ({ value, max = 100, step = 0.1, onValueChange, className = "", disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [hoverValue, setHoverValue] = useState(null)
  const sliderRef = useRef(null)

  const handleMouseDown = (e) => {
    if (disabled) return
    setIsDragging(true)
    updateSliderValue(e)
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const newValue = (percentage / 100) * max

    if (isDragging && !disabled) {
      onValueChange([newValue])
    } else {
      setHoverValue(percentage)
    }
  }

  const handleMouseLeave = () => {
    setHoverValue(null)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const updateSliderValue = (e) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const newValue = (percentage / 100) * max
    onValueChange([newValue])
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging])

  const percentage = (value[0] / max) * 100

  return (
    <div
      ref={sliderRef}
      className={`relative h-3 bg-white/20 rounded-full cursor-pointer group overflow-hidden ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Progress track with glow */}
      <div
        className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-red-600 to-red-700 rounded-full shadow-lg shadow-red-500/30 transition-all duration-200 ease-out"
        style={{ width: `${percentage}%` }}
      />

      {/* Hover preview */}
      {hoverValue !== null && !isDragging && (
        <div
          className="absolute top-0 h-full bg-white/30 rounded-full transition-all duration-100"
          style={{
            left: 0,
            width: `${hoverValue}%`,
            opacity: 0.6,
          }}
        />
      )}

      {/* Thumb with better positioning */}
      <div
        className="absolute top-1/2 w-4 h-4 bg-white border-2 border-red-500 rounded-full transform -translate-y-1/2 shadow-xl opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 ease-out"
        style={{ left: `calc(${percentage}% - 8px)` }}
      >
        <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse opacity-30" />
      </div>
    </div>
  )
}

// Custom Volume Slider avec amélioration visuelle
const VolumeSlider = ({ value, onValueChange, className = "" }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [hoverValue, setHoverValue] = useState(null)
  const sliderRef = useRef(null)

  const handleMouseDown = (e) => {
    setIsDragging(true)
    updateVolume(e)
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const newValue = percentage / 100

    if (isDragging) {
      onValueChange([newValue])
    } else {
      setHoverValue(percentage)
    }
  }

  const handleMouseLeave = () => {
    setHoverValue(null)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const updateVolume = (e) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const newValue = percentage / 100
    onValueChange([newValue])
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging])

  const percentage = value[0] * 100

  return (
    <div
      ref={sliderRef}
      className={`relative h-2 bg-white/20 rounded-full cursor-pointer group w-24 overflow-hidden ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Volume bars effect */}
      <div className="absolute inset-0 flex items-center space-x-0.5">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-full rounded-full transition-all duration-200 ${
              (i + 1) * 12.5 <= percentage ? "bg-gradient-to-t from-white to-white/80 shadow-sm" : "bg-white/20"
            }`}
          />
        ))}
      </div>

      {/* Hover preview */}
      {hoverValue !== null && !isDragging && (
        <div
          className="absolute top-0 h-full bg-white/40 rounded-full transition-all duration-100"
          style={{
            left: 0,
            width: `${hoverValue}%`,
          }}
        />
      )}

      {/* Thumb */}
      <div
        className="absolute top-1/2 w-3 h-3 bg-white rounded-full transform -translate-y-1/2 shadow-lg opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300"
        style={{ left: `calc(${percentage}% - 6px)` }}
      />
    </div>
  )
}

const VideoPlayerComponent = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, addToFavorites, removeFromFavorites, favorites, rateVideo, getUserRating } = useAuth()
  const { getVideoById, incrementViews, videos } = useVideo()

  // Core video state
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [videoReady, setVideoReady] = useState(false)

  // Playback state
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const mouseTimeoutRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [buffered, setBuffered] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const secManagerRef = useRef<VideoSecurityManager | null>(null)
  useEffect(() => {
    return () => {
      secManagerRef.current?.cleanup?.();
    };
  }, []);

  // UI state
  const [showControls, setShowControls] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showEpisodes, setShowEpisodes] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [userRating, setUserRating] = useState(null)
  const [controlsTimeout, setControlsTimeout] = useState(null)
  const [cursorVisible, setCursorVisible] = useState(true)

  // Series/Episodes state
  const [currentEpisode, setCurrentEpisode] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [relatedVideos, setRelatedVideos] = useState([])

  // Progress tracking
  const [hasIncrementedViews, setHasIncrementedViews] = useState(false)
  const { resumeData, saveProgress } = useWatchHistory(video)

  const isFavorite = video ? favorites.includes(video.id) : false

  // Gestion améliorée du curseur
  const handleMouseMove = useCallback(
    (e?: React.MouseEvent) => {
      setCursorVisible(true)
      setShowControls(true)
      document.body.style.cursor = "default"

      // Clear existing timeout
      if (mouseTimeoutRef.current) {
        clearTimeout(mouseTimeoutRef.current)
      }

      // Set new timeout pour cacher le curseur après 3 secondes d'inactivité
      mouseTimeoutRef.current = setTimeout(() => {
        if (isPlaying && !showSettings && !showEpisodes && !showRating) {
          setCursorVisible(false)
          setShowControls(false)
          document.body.style.cursor = "none"
        }
      }, 3000)
    },
    [isPlaying, showSettings, showEpisodes, showRating],
  )

  // Hide header on mount
  useEffect(() => {
    const header = document.querySelector("header")
    if (header) header.style.display = "none"
    return () => {
      if (header) header.style.display = "block"
      if (mouseTimeoutRef.current) {
        clearTimeout(mouseTimeoutRef.current)
      }
      document.body.style.cursor = "default"
    }
  }, [])

  // Track video ref readiness
  useEffect(() => {
    if (videoRef.current && !videoReady) {
      setVideoReady(true)
    }
  }, [videoRef.current, videoReady])

  // Load video data
  useEffect(() => {
    if (id) loadVideo()
  }, [id])

  // Load video source when both video data and ref are ready
  useEffect(() => {
    if (video && videoReady && !currentEpisode) {
      if (video.type !== "series" && video.video_url) {
        loadVideoSource(video.video_url, null)
      }
    }
  }, [video, videoReady, currentEpisode])

  // Auto-resume from history when video is loaded
  useEffect(() => {
    if (videoReady && resumeData && videoRef.current && duration > 0) {
      // Resume playback from saved position
      if (resumeData.currentTime > 0 && resumeData.currentTime < duration * 0.9) {
        videoRef.current.currentTime = resumeData.currentTime;
      }
    }
  }, [videoReady, resumeData, duration])

  // Auto-hide controls avec gestion améliorée
  useEffect(() => {
    if (showControls && isPlaying && !showSettings && !showEpisodes && !showRating) {
      if (controlsTimeout) clearTimeout(controlsTimeout)
      const timeout = setTimeout(() => {
        setShowControls(false)
        setCursorVisible(false)
        document.body.style.cursor = "none"
      }, 4000)
      setControlsTimeout(timeout)
    }
    return () => {
      if (controlsTimeout) clearTimeout(controlsTimeout)
    }
  }, [showControls, isPlaying, showSettings, showEpisodes, showRating])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!videoRef.current) return

      switch (e.key) {
        case " ":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowLeft":
          e.preventDefault()
          skipBackward()
          break
        case "ArrowRight":
          e.preventDefault()
          skipForward()
          break
        case "ArrowUp":
          e.preventDefault()
          adjustVolume(0.1)
          break
        case "ArrowDown":
          e.preventDefault()
          adjustVolume(-0.1)
          break
        case "m":
          e.preventDefault()
          toggleMute()
          break
        case "f":
          e.preventDefault()
          toggleFullscreen()
          break
        case "Escape":
          if (isFullscreen) toggleFullscreen()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  // Video event listeners
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration)
    }

    const handleProgress = () => {
      if (videoElement.buffered.length > 0) {
        const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1)
        const bufferedPercent = (bufferedEnd / videoElement.duration) * 100
        setBuffered(bufferedPercent)
      }
    }

    const handleWaiting = () => setIsBuffering(true)
    const handleCanPlay = () => setIsBuffering(false)
    const handleError = () => {
      setIsBuffering(false)
      setError("Erreur de lecture vidéo")
    }

    videoElement.addEventListener("timeupdate", handleTimeUpdate)
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata)
    videoElement.addEventListener("progress", handleProgress)
    videoElement.addEventListener("waiting", handleWaiting)
    videoElement.addEventListener("canplay", handleCanPlay)
    videoElement.addEventListener("error", handleError)

    return () => {
      videoElement.removeEventListener("timeupdate", handleTimeUpdate)
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata)
      videoElement.removeEventListener("progress", handleProgress)
      videoElement.removeEventListener("waiting", handleWaiting)
      videoElement.removeEventListener("canplay", handleCanPlay)
      videoElement.removeEventListener("error", handleError)
    }
  }, [videoReady])

  // Auto-save progress
  useEffect(() => {
    if (!user || !video || !videoRef.current) return

    const interval = setInterval(() => {
      const videoElement = videoRef.current
      if (videoElement && videoElement.currentTime > 0) {
        saveProgress(currentEpisode?.id || null, videoElement.currentTime, videoElement.duration)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [user, video, currentEpisode, saveProgress])

  const loadSeriesEpisodes = async (seriesId) => {
    try {
      const { data: episodesData, error } = await supabase
        .from("episodes")
        .select("*")
        .eq("series_id", seriesId)
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true })

      if (error) {
        console.error("Error loading episodes:", error)
        return
      }

      setEpisodes(episodesData || [])

      if (episodesData && episodesData.length > 0) {
        const episodesBySeason = episodesData.reduce((acc, episode) => {
          const season = episode.season_number || 1
          if (!acc[season]) acc[season] = []
          acc[season].push(episode)
          return acc
        }, {})

        const seasonNumbers = Object.keys(episodesBySeason).map(Number).sort()
        setSeasons(seasonNumbers)

        const firstSeason = seasonNumbers[0] || 1
        const firstEpisode = episodesBySeason[firstSeason]?.[0]

        if (firstEpisode?.video_url) {
          setSelectedSeason(firstSeason)
          setCurrentEpisode(firstEpisode)
        }
      }
    } catch (error) {
      console.error("Error in loadSeriesEpisodes:", error)
      setError("Erreur lors du chargement des épisodes")
    }
  }

  const loadVideo = async () => {
    if (!id) return

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.from("videos").select("*").eq("id", id).single()

      if (error) {
        console.error("Supabase error:", error)
        setError("Erreur lors du chargement de la vidéo")
        return
      }

      setVideo(data)

      if (data.type === "series") {
        await loadSeriesEpisodes(data.id)
      }

      // Load related videos
      const related = videos.filter((v) => v.id !== id && v.category === data.category).slice(0, 12)
      setRelatedVideos(related)

      // Load user data
      if (user) {
        loadUserRating()
      }
    } catch (error) {
      console.error("Error loading video:", error)
      setError("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  // Load video source when episode changes and ref is ready
  useEffect(() => {
    if (currentEpisode && videoReady && currentEpisode.video_url) {
      loadVideoSource(currentEpisode.video_url, currentEpisode.id)
    }
  }, [currentEpisode, videoReady])

  const loadVideoSource = async (videoUrl, episodeId) => {
    if (!videoUrl) {
      console.error("Missing videoUrl:", videoUrl)
      return
    }

    if (!videoRef.current) {
      console.error("videoRef.current is null, waiting...")
      return
    }

    try {
      setIsBuffering(true)
      setError(null)

      if (!user) {
        toast({
          title: "Authentification requise",
          description: "Vous devez être connecté pour regarder des vidéos",
          variant: "destructive",
        })
        return
      }

      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        toast({
          title: "Erreur d'authentification",
          description: "Token d'authentification manquant. Veuillez vous reconnecter.",
          variant: "destructive",
        })
        return
      }

      const videoId = episodeId || video?.id || id

      const videoElement = videoRef.current

      // Reset video element
      videoElement.pause()
      videoElement.currentTime = 0
      videoElement.removeAttribute("src")
      videoElement.load()

      // Nettoyer l'ancien loader si nécessaire
      if (secManagerRef.current) {
        secManagerRef.current.cleanup();
        secManagerRef.current = null;
      }

      // Add comprehensive error handling
      const handleVideoError = (event) => {
        console.error("Video error event:", event)
        const error = videoElement.error
        if (error) {
          let errorMessage = "Erreur de lecture vidéo"
          switch (error.code) {
            case error.MEDIA_ERR_NETWORK:
              errorMessage = "Erreur de réseau lors du chargement"
              break
            case error.MEDIA_ERR_DECODE:
              errorMessage = "Erreur de décodage vidéo"
              break
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = "Format vidéo non supporté"
              break
            case error.MEDIA_ERR_ABORTED:
              errorMessage = "Chargement interrompu"
              break
          }
          setError(errorMessage)
        }
        setIsBuffering(false)
      }

      const handleVideoLoad = async () => {
        setIsBuffering(false)
        setError(null)

        // Resume from saved progress if available
        if (resumeData && resumeData.progress > 0 && resumeData.progress < 0.9) {
          const resumeTime = resumeData.progress * videoElement.duration
          videoElement.currentTime = resumeTime
        }

        // Autoplay the video
        try {
          await videoElement.play()
          setIsPlaying(true)
        } catch (error) {
          console.warn("Autoplay failed (browser policy):", error)
        }
      }

      const handleCanPlay = async () => {
        setIsBuffering(false)

        if (!isPlaying && !videoElement.paused === false) {
          try {
            await videoElement.play()
            setIsPlaying(true)
          } catch (error) {
            console.warn("Autoplay failed from canplay:", error)
          }
        }
      }

      // Charger la vidéo de manière sécurisée avec streaming progressif
      console.log('[VideoPlayer] 🎬 Démarrage du streaming sécurisé pour videoId:', videoId);
      
      if (!secManagerRef.current) {
        secManagerRef.current = new VideoSecurityManager();
      }

      try {
        setIsBuffering(true);
        
        // Configurer les event listeners avant de définir la source
        videoElement.addEventListener("error", handleVideoError, { once: true });
        videoElement.addEventListener("loadeddata", handleVideoLoad, { once: true });
        videoElement.addEventListener("canplay", handleCanPlay, { once: true });

        // Charger la vidéo via le système sécurisé avec streaming MSE
        // On passe directement le loader avec l'élément vidéo pour le streaming progressif
        const { SecureChunkLoader } = await import('@/utils/secureChunkLoader');
        const loader = new SecureChunkLoader({
          videoUrl,
          videoId,
          sessionToken: token,
          videoElement, // Passer l'élément vidéo pour activer le streaming MSE
          onProgress: (loaded, total) => {
            const progressPercent = total > 0 ? (loaded / total) * 100 : 0;
            setBuffered(progressPercent);
            console.log(`[VideoPlayer] 📊 Progression: ${Math.round(progressPercent)}%`);
          }
        });

        const blobUrl = await loader.load();
        
        // Si ce n'est pas déjà fait par MSE, définir la source
        if (!videoElement.src || !videoElement.src.startsWith('blob:')) {
          videoElement.src = blobUrl;
          await videoElement.load();
        }
        
        console.log('[VideoPlayer] ✅ Streaming démarré avec succès');
        setIsBuffering(false);
        
      } catch (error) {
        console.error('[VideoPlayer] ❌ Erreur streaming vidéo:', error);
        setError(error instanceof Error ? error.message : 'Impossible de charger la vidéo');
        setIsBuffering(false);
      }
    } catch (error) {
      console.error("Error in loadVideoSource:", error)
      setError(`Erreur de chargement: ${error instanceof Error ? error.message : "Erreur inconnue"}`)
      setIsBuffering(false)
    }
  }

  const loadUserRating = async () => {
    if (user && video) {
      const rating = await getUserRating(video.id)
      setUserRating(rating)
    }
  }

  const togglePlay = useCallback(async () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    try {
      if (isPlaying) {
        videoElement.pause()
        setIsPlaying(false)
      } else {
        await videoElement.play()
        setIsPlaying(true)

        if (!hasIncrementedViews && video?.id) {
          incrementViews(video.id)
          setHasIncrementedViews(true)
        }
      }
    } catch (error) {
      toast({
        title: "Erreur de lecture",
        description: "Impossible de lire la vidéo",
        variant: "destructive",
      })
    }
    handleMouseMove()
  }, [isPlaying, hasIncrementedViews, video?.id, incrementViews, handleMouseMove])

  const toggleMute = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    videoElement.muted = !isMuted
    setIsMuted(!isMuted)
    handleMouseMove()
  }

  const adjustVolume = (delta) => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const newVolume = Math.max(0, Math.min(1, volume + delta))
    videoElement.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    handleMouseMove()
  }

  const handleVolumeChange = (values) => {
    const newVolume = values[0]
    const videoElement = videoRef.current
    if (!videoElement) return

    videoElement.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const handleProgressChange = (values) => {
    const newProgress = values[0]
    const videoElement = videoRef.current
    if (!videoElement || !duration) return

    const newTime = (newProgress / 100) * duration
    videoElement.currentTime = newTime
    setCurrentTime(newTime)
  }

  const skipForward = () => {
    const videoElement = videoRef.current
    if (!videoElement) return
    videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 10)
    handleMouseMove()
  }

  const skipBackward = () => {
    const videoElement = videoRef.current
    if (!videoElement) return
    videoElement.currentTime = Math.max(0, videoElement.currentTime - 10)
    handleMouseMove()
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  const handleFavoriteToggle = async () => {
    if (!user || !video) return

    try {
      if (isFavorite) {
        await removeFromFavorites(video.id)
        toast({ title: "Retiré des favoris" })
      } else {
        await addToFavorites(video.id)
        toast({ title: "Ajouté aux favoris" })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier les favoris",
        variant: "destructive",
      })
    }
  }

  const handleRating = async (rating) => {
    if (!user || !video) return

    try {
      await rateVideo(video.id, rating)
      setUserRating(rating)
      setShowRating(false)
      toast({ title: "Note enregistrée" })
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la note",
        variant: "destructive",
      })
    }
  }

  const playEpisode = async (episode) => {
    setCurrentEpisode(episode)
    setCurrentTime(0)
    setHasIncrementedViews(false)
    setShowEpisodes(false)
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00"

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-700/40 border-t-red-500 rounded-full animate-spin" />
            <div
              className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-red-400/60 rounded-full animate-spin"
              style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
            />
          </div>
          <div className="text-center">
            <p className="text-white text-xl font-semibold mb-2">Chargement de la vidéo...</p>
            <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 mx-auto bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <X className="h-12 w-12 text-red-500" />
            </div>
            <div className="absolute inset-0 w-24 h-24 mx-auto border-2 border-red-500/30 rounded-full animate-ping" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">{error || "Vidéo non trouvée"}</h2>
          <p className="text-gray-400 text-lg mb-6">La vidéo demandée n'est pas disponible</p>
          <Button
            onClick={() => navigate(-1)}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0 px-8 py-3 rounded-xl shadow-lg shadow-red-600/25 transform hover:scale-105 transition-all duration-300"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black group overflow-hidden"
      style={{ cursor: cursorVisible ? "default" : "none" }}
      onMouseMove={handleMouseMove}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={video.thumbnail}
        autoPlay={false}
        muted={false}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* Loading/Buffering Overlay */}
      {(isBuffering || loading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center space-y-8">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-gray-700/30 border-t-red-500 rounded-full animate-spin" />
              <div
                className="absolute inset-0 w-24 h-24 border-4 border-transparent border-r-red-400/50 rounded-full animate-spin"
                style={{ animationDirection: "reverse", animationDuration: "2s" }}
              />
              <div
                className="absolute inset-2 w-20 h-20 border-2 border-gray-800/40 border-b-red-300/60 rounded-full animate-spin"
                style={{ animationDuration: "3s" }}
              />
            </div>
            <div className="text-center space-y-4">
              <p className="text-white font-semibold text-2xl">
                {loading ? "Chargement..." : "Mise en mémoire tampon..."}
              </p>
              <div className="w-80 h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-red-600 to-red-700 rounded-full shadow-lg transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progress || 20, 100)}%` }}
                />
              </div>
              <p className="text-gray-400 text-sm">Préparation de la vidéo...</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Controls */}
      <div
        className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/95 via-black/60 to-transparent p-6 transition-all duration-700 ease-out backdrop-blur-sm ${
          showControls && cursorVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl px-6 py-3 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Retour
            </Button>
            <div className="text-white space-y-1">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {video.title}
              </h1>
              {currentEpisode && (
                <p className="text-base text-gray-300 font-medium">
                  S{currentEpisode.season_number || 1}E{currentEpisode.episode_number || 1} - {currentEpisode.title}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {video.type === "series" && episodes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEpisodes(!showEpisodes)}
                className="text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-3 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <List className="h-6 w-6" />
              </Button>
            )}

            {user && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFavoriteToggle}
                  className={`text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-3 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                    isFavorite ? "text-red-500 bg-red-500/20 border-red-500/30" : ""
                  }`}
                >
                  <Heart
                    className={`h-6 w-6 transition-all duration-300 ${isFavorite ? "fill-current animate-pulse" : ""}`}
                  />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRating(!showRating)}
                  className={`text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-3 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                    userRating ? "text-yellow-500 bg-yellow-500/20 border-yellow-500/30" : ""
                  }`}
                >
                  <Star
                    className={`h-6 w-6 transition-all duration-300 ${userRating ? "fill-current animate-pulse" : ""}`}
                  />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-all duration-700 ease-out backdrop-blur-sm ${
          showControls && cursorVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Progress Bar */}
        <div className="px-8 pb-6">
          <VideoSlider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={handleProgressChange}
            className="w-full mb-4"
          />
          <div className="flex justify-between text-sm text-gray-300 font-mono px-2">
            <span className="bg-black/40 px-3 py-1 rounded-lg backdrop-blur-sm">{formatTime(currentTime)}</span>
            <span className="bg-black/40 px-3 py-1 rounded-lg backdrop-blur-sm">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between px-8 pb-8">
          <div className="flex items-center space-x-8">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="lg"
              onClick={togglePlay}
              className="text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-full p-6 hover:scale-110 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-2xl hover:shadow-red-500/20"
            >
              {isPlaying ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12 ml-1" />}
            </Button>

            {/* Skip Controls */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipBackward}
                className="text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-4 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <SkipBack className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={skipForward}
                className="text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-4 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <SkipForward className="h-6 w-6" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center space-x-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-3 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-6 w-6" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-6 w-6" />
                ) : (
                  <Volume2 className="h-6 w-6" />
                )}
              </Button>

              <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out transform translate-x-0 group-hover:translate-x-0">
                <VolumeSlider value={[volume]} onValueChange={handleVolumeChange} />
              </div>
            </div>

            {/* Time Display */}
            <div className="text-white text-base font-mono bg-black/40 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10 shadow-lg">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className={`text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-3 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                showSettings ? "bg-white/20 border-white/20" : ""
              }`}
            >
              <Settings className={`h-6 w-6 transition-all duration-300 ${showSettings ? "animate-spin" : ""}`} />
            </Button>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 hover:text-white transition-all duration-300 rounded-xl p-3 backdrop-blur-sm bg-black/20 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Episodes Panel */}
      {showEpisodes && episodes.length > 0 && (
        <div
          className={`absolute right-0 top-0 bottom-0 w-[28rem] bg-black/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto shadow-2xl transform transition-all duration-500 ease-out ${
            showEpisodes ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <List className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">Episodes</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEpisodes(false)}
                className="text-white hover:bg-white/20 transition-all duration-300 rounded-xl p-3 hover:rotate-90"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Season Selector */}
            {seasons.length > 1 && (
              <div className="flex flex-wrap gap-3 mb-8">
                {seasons.map((season) => (
                  <Button
                    key={season}
                    variant={selectedSeason === season ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSeason(season)}
                    className={`transition-all duration-300 rounded-xl px-4 py-2 transform hover:scale-105 ${
                      selectedSeason === season
                        ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-red-600 shadow-lg shadow-red-600/30"
                        : "bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-500"
                    }`}
                  >
                    Saison {season}
                  </Button>
                ))}
              </div>
            )}

            {/* Episodes List */}
            <div className="space-y-4">
              {episodes
                .filter((ep) => (ep.season_number || ep.seasonNumber || 1) === selectedSeason)
                .map((episode, index) => (
                  <Card
                    key={episode.id}
                    className={`p-6 cursor-pointer transition-all duration-400 hover:bg-gray-800/60 border rounded-2xl transform hover:scale-105 hover:shadow-xl ${
                      currentEpisode?.id === episode.id
                        ? "bg-gradient-to-br from-red-900/30 to-red-800/20 border-red-500/40 shadow-xl shadow-red-500/20 scale-105"
                        : "bg-gray-900/60 border-gray-700/50 hover:border-gray-600/70 backdrop-blur-sm"
                    }`}
                    onClick={() => playEpisode(episode)}
                  >
                    <div className="flex items-start space-x-5">
                      <div className="flex-shrink-0">
                        <div
                          className={`w-28 h-16 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg ${
                            currentEpisode?.id === episode.id
                              ? "bg-gradient-to-br from-red-600/40 to-red-700/30 shadow-red-500/20"
                              : "bg-gray-700/60 hover:bg-gray-600/60"
                          }`}
                        >
                          <Play
                            className={`h-6 w-6 text-white transition-all duration-300 ${
                              currentEpisode?.id === episode.id ? "animate-pulse" : ""
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-center space-x-3 mb-3">
                          <Badge
                            variant="secondary"
                            className="text-xs bg-gray-700/80 text-gray-200 hover:bg-gray-600/80 rounded-lg px-3 py-1"
                          >
                            Ep {episode.episode_number || index + 1}
                          </Badge>
                          {currentEpisode?.id === episode.id && (
                            <Badge
                              variant="default"
                              className="text-xs bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 rounded-lg px-3 py-1 animate-pulse"
                            >
                              En cours
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-white font-semibold text-base truncate leading-tight">{episode.title}</h4>
                        {episode.description && (
                          <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed">{episode.description}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRating && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
          <div className="transform transition-all duration-500 ease-out scale-100">
            <Card className="p-10 bg-gray-900/95 border border-gray-700/50 shadow-2xl backdrop-blur-xl max-w-lg w-full mx-4 rounded-3xl">
              <div className="text-center space-y-8">
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                    <Star className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold text-white">Noter cette vidéo</h3>
                  <p className="text-gray-400 text-lg">Votre avis compte pour nous</p>
                </div>
                <div className="flex items-center justify-center space-x-4">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Button
                      key={rating}
                      variant="ghost"
                      size="lg"
                      onClick={() => handleRating(rating)}
                      className={`text-4xl hover:bg-white/10 transition-all duration-300 rounded-2xl p-4 transform hover:scale-110 ${
                        userRating && userRating >= rating
                          ? "text-yellow-500 animate-pulse"
                          : "text-gray-500 hover:text-yellow-400"
                      }`}
                    >
                      <Star
                        className={`h-10 w-10 transition-all duration-300 ${
                          userRating && userRating >= rating ? "fill-current" : ""
                        }`}
                      />
                    </Button>
                  ))}
                </div>
                <div className="flex space-x-4 justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowRating(false)}
                    className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl px-6 py-3 transition-all duration-300 transform hover:scale-105"
                  >
                    Annuler
                  </Button>
                  {userRating && (
                    <Button
                      onClick={() => handleRating(0)}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0 rounded-xl px-6 py-3 shadow-lg shadow-red-600/30 transition-all duration-300 transform hover:scale-105"
                    >
                      Supprimer la note
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div
          className={`absolute bottom-32 right-8 w-[26rem] bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-3xl shadow-2xl transform transition-all duration-500 ease-out ${
            showSettings ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"
          }`}
        >
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between pb-6 border-b border-gray-700/50">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center border border-green-500/30">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                <h3 className="text-white font-bold text-xl">Paramètres</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl p-3 transition-all duration-300 hover:rotate-90"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Vitesse de lecture */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl flex items-center justify-center border border-green-500/30">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                <label className="text-white font-semibold text-lg">Vitesse de lecture</label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { rate: 0.5, label: "0.5x", desc: "Lent" },
                  { rate: 0.75, label: "0.75x", desc: "Réduit" },
                  { rate: 1, label: "1x", desc: "Normal" },
                  { rate: 1.25, label: "1.25x", desc: "Rapide" },
                  { rate: 1.5, label: "1.5x", desc: "Plus rapide" },
                  { rate: 2, label: "2x", desc: "Très rapide" },
                ].map(({ rate, label, desc }) => (
                  <Button
                    key={rate}
                    variant={playbackRate === rate ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setPlaybackRate(rate)
                      if (videoRef.current) {
                        videoRef.current.playbackRate = rate
                      }
                    }}
                    className={`h-16 flex flex-col items-center justify-center transition-all duration-300 rounded-2xl transform hover:scale-105 ${
                      playbackRate === rate
                        ? "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-xl shadow-red-600/30 scale-105"
                        : "text-gray-300 hover:text-white hover:bg-gray-800/60 border border-gray-700/50 hover:border-gray-600/70 backdrop-blur-sm"
                    }`}
                  >
                    <span className="text-sm font-bold">{label}</span>
                    <span className="text-xs opacity-80">{desc}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoPlayerComponent
