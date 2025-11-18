import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  RotateCcw,
  Volume1,
  Settings,
  ArrowLeft,
  ChevronRight,
  List,
  Heart,
  Share,
  MessageCircle,
  Star,
  Clock,
} from "lucide-react"

interface VideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>
  isPlaying: boolean
  isMuted: boolean
  progress: number
  volume: number
  currentTime: number
  duration: number
  isFullscreen: boolean
  showControls: boolean
  playbackRate: number
  subtitles: any[]
  selectedSubtitle: any
  title?: string
  video?: any
  episodes?: any[]
  currentEpisode?: any
  selectedSeason?: number
  onTogglePlay: () => void
  onToggleMute: () => void
  onVolumeChange: (volume: number) => void
  onProgressChange: (progress: number) => void
  onToggleFullscreen: () => void
  onPlaybackRateChange: (rate: number) => void
  onSubtitleChange: (subtitle: any) => void
  onSkipTime: (seconds: number) => void
  onGoBack?: () => void
  onNextEpisode?: () => void
  onShowEpisodes?: () => void
  onPlayEpisode?: (episode: any) => void
}

const VideoControls = ({
  videoRef,
  isPlaying,
  isMuted,
  progress,
  volume,
  currentTime,
  duration,
  isFullscreen,
  showControls,
  playbackRate,
  subtitles,
  selectedSubtitle,
  title,
  video,
  episodes = [],
  currentEpisode,
  selectedSeason = 1,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onProgressChange,
  onToggleFullscreen,
  onPlaybackRateChange,
  onSubtitleChange,
  onSkipTime,
  onGoBack,
  onNextEpisode,
  onShowEpisodes,
  onPlayEpisode,
}: VideoControlsProps) => {
  const [showSettings, setShowSettings] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [showEpisodesPanel, setShowEpisodesPanel] = useState(false)

  const [isLiked, setIsLiked] = useState(false)
  const [showTooltip, setShowTooltip] = useState("")
  const [bufferedProgress, setBufferedProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isVolumeDragging, setIsVolumeDragging] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [previewTime, setPreviewTime] = useState(0)
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number>()

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return VolumeX
    if (volume < 0.5) return Volume1
    return Volume2
  }

  const VolumeIcon = getVolumeIcon()

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    onVolumeChange(newVolume)
  }

  const handleProgressUpdate = (e: React.MouseEvent, force = false) => {
    if (!isDragging && !force) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newProgress = Math.max(0, Math.min(100, (clickX / rect.width) * 100))

    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Smooth animation using requestAnimationFrame
    animationFrameRef.current = requestAnimationFrame(() => {
      onProgressChange(newProgress)
    })
  }

  const handleProgressHover = (e: React.MouseEvent) => {
    if (isDragging) return

    const rect = e.currentTarget.getBoundingClientRect()
    const hoverX = e.clientX - rect.left
    const hoverProgress = Math.max(0, Math.min(100, (hoverX / rect.width) * 100))
    const hoverTime = (hoverProgress / 100) * duration

    setPreviewProgress(hoverProgress)
    setPreviewTime(hoverTime)
    setShowPreview(true)
  }

  const handleVolumeUpdate = (e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>, force = false) => {
    if (!isVolumeDragging && !force) return

    let newVolume: number

    if ("clientX" in e) {
      // MouseEvent
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      newVolume = Math.max(0, Math.min(1, clickX / rect.width))
    } else {
      // ChangeEvent
      newVolume = Number.parseFloat(e.target.value)
    }

    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Smooth animation using requestAnimationFrame
    animationFrameRef.current = requestAnimationFrame(() => {
      onVolumeChange(newVolume)
    })
  }

  // Global mouse events for smooth dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging || isVolumeDragging) {
        e.preventDefault()
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsVolumeDragging(false)
    }

    if (isDragging || isVolumeDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = ""
    }
  }, [isDragging, isVolumeDragging])

  useEffect(() => {
    const updateBuffering = () => {
      if (videoRef.current) {
        const video = videoRef.current
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1)
          const bufferedPercent = (bufferedEnd / duration) * 100
          setBufferedProgress(Math.min(bufferedPercent, 100))
        }
      } else {
        // Fallback simulation
        setBufferedProgress((prev) => Math.min(prev + Math.random() * 5, progress + 15))
      }
    }

    const interval = setInterval(updateBuffering, 500)
    return () => clearInterval(interval)
  }, [progress, duration, videoRef])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideInUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        /* Enhanced progress bar animations */
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.5); }
          50% { box-shadow: 0 0 20px rgba(255, 107, 107, 0.8), 0 0 30px rgba(255, 107, 107, 0.4); }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
        
        .animate-slide-in-up {
          animation: slideInUp 0.2s ease-out;
        }
        
        .animate-pulse-slow {
          animation: pulse 2s infinite;
        }

        /* Improved progress bar styling */
        .progress-container {
          position: relative;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          overflow: hidden;
          cursor: pointer;
          transition: height 0.2s ease;
        }

        .progress-container:hover {
          height: 8px;
        }

        .progress-container.dragging {
          height: 10px;
        }

        .buffered-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, 
            rgba(255, 255, 255, 0.3) 0%, 
            rgba(255, 255, 255, 0.4) 50%, 
            rgba(255, 255, 255, 0.3) 100%);
          border-radius: inherit;
          transition: width 0.3s ease;
        }

        .watched-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #ff6b6b 0%, #ff5252 100%);
          border-radius: inherit;
          transition: width 0.1s ease;
          animation: glow 2s infinite;
        }

        .preview-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: rgba(255, 255, 255, 0.6);
          border-radius: inherit;
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }

        .preview-progress.show {
          opacity: 1;
        }

        .progress-thumb {
          position: absolute;
          top: 50%;
          width: 16px;
          height: 16px;
          background: #ffffff;
          border: 2px solid #ff6b6b;
          border-radius: 50%;
          transform: translateX(-50%) translateY(-50%);
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          opacity: 0;
        }

        .progress-container:hover .progress-thumb,
        .progress-container.dragging .progress-thumb {
          opacity: 1;
          transform: translateX(-50%) translateY(-50%) scale(1.2);
        }

        .progress-container.dragging .progress-thumb {
          transform: translateX(-50%) translateY(-50%) scale(1.4);
          box-shadow: 0 4px 16px rgba(255, 107, 107, 0.4);
        }

        /* Enhanced shimmer effect for buffering */
        .buffered-progress::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.4) 50%, 
            transparent 100%);
          animation: shimmer 2s infinite;
        }

        /* Preview tooltip styling */
        .progress-preview {
          position: absolute;
          bottom: 120%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .progress-preview.show {
          opacity: 1;
        }

        .progress-preview::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: rgba(0, 0, 0, 0.9);
        }

        .control-button {
          @apply transition-all duration-200 hover:scale-110 hover:text-white;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        .control-button:hover {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
        }

        .viki-gradient {
          background: linear-gradient(135deg, 
            rgba(255, 107, 107, 0.1) 0%, 
            rgba(255, 107, 107, 0.05) 50%, 
            transparent 100%);
        }

        .episode-thumbnail {
          transition: all 0.3s ease;
        }
        
        .episode-thumbnail:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
        }

        .tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          margin-bottom: 8px;
        }

        .tooltip.show {
          opacity: 1;
        }
      `}</style>

      {/* Main Controls Overlay */}
      <div className={`absolute inset-0 transition-all duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/70" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-40">
          <div className="flex items-center justify-between">
            {/* Left Side */}
            <div className="flex items-center space-x-4">
              {onGoBack && (
                <div className="relative">
                  <button
                    onClick={onGoBack}
                    className="bg-black/60 hover:bg-black/80 text-white rounded-full p-3 control-button backdrop-blur-sm"
                    onMouseEnter={() => setShowTooltip("back")}
                    onMouseLeave={() => setShowTooltip("")}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className={`tooltip ${showTooltip === "back" ? "show" : ""}`}>Retour</div>
                </div>
              )}

              {title && (
                <div className="viki-gradient backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                  <h3 className="text-white font-semibold text-lg truncate max-w-md">{title}</h3>
                  {currentEpisode && (
                    <p className="text-gray-300 text-sm">
                      Épisode {currentEpisode.episodeNumber} • Saison {selectedSeason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Side - Social Actions */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <button
                  onClick={() => setIsLiked(!isLiked)}
                  className={`p-3 rounded-full control-button backdrop-blur-sm ${
                    isLiked ? "bg-red-500/80 text-white" : "bg-black/60 text-white/80"
                  }`}
                  onMouseEnter={() => setShowTooltip("like")}
                  onMouseLeave={() => setShowTooltip("")}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
                </button>
                <div className={`tooltip ${showTooltip === "like" ? "show" : ""}`}>
                  {isLiked ? "Retiré des favoris" : "Ajouter aux favoris"}
                </div>
              </div>

              <div className="relative">
                <button
                  className="bg-black/60 hover:bg-black/80 text-white/80 rounded-full p-3 control-button backdrop-blur-sm"
                  onMouseEnter={() => setShowTooltip("share")}
                  onMouseLeave={() => setShowTooltip("")}
                >
                  <Share className="w-5 h-5" />
                </button>
                <div className={`tooltip ${showTooltip === "share" ? "show" : ""}`}>Partager</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-40">
          <div className="px-4 pb-3">
            <div
              ref={progressBarRef}
              className={`progress-container ${isDragging ? "dragging" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault()
                setIsDragging(true)
                handleProgressUpdate(e, true)
              }}
              onMouseMove={(e) => {
                handleProgressHover(e)
                if (isDragging) {
                  handleProgressUpdate(e)
                }
              }}
              onMouseLeave={() => {
                setShowPreview(false)
              }}
              onClick={(e) => {
                if (!isDragging) {
                  handleProgressUpdate(e, true)
                }
              }}
            >
              {/* Buffered Progress */}
              <div className="buffered-progress" style={{ width: `${bufferedProgress}%` }} />

              {/* Preview Progress */}
              <div
                className={`preview-progress ${showPreview && !isDragging ? "show" : ""}`}
                style={{ width: `${previewProgress}%` }}
              />

              {/* Watched Progress */}
              <div className="watched-progress" style={{ width: `${progress}%` }} />

              {/* Progress Thumb */}
              <div className="progress-thumb" style={{ left: `${progress}%` }} />

              <div
                className={`progress-preview ${showPreview && !isDragging ? "show" : ""}`}
                style={{ left: `${previewProgress}%` }}
              >
                {formatTime(previewTime)}
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-gradient-to-t from-black/90 to-transparent p-4 animate-slide-in-up">
            <div className="flex items-center justify-between">
              {/* Left Controls */}
              <div className="flex items-center space-x-4">
                {/* Play/Pause */}
                <div className="relative">
                  <button
                    onClick={onTogglePlay}
                    className="text-white control-button"
                    onMouseEnter={() => setShowTooltip("play")}
                    onMouseLeave={() => setShowTooltip("")}
                  >
                    {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 fill-current" />}
                  </button>
                  <div className={`tooltip ${showTooltip === "play" ? "show" : ""}`}>
                    {isPlaying ? "Pause" : "Lecture"}
                  </div>
                </div>

                {/* Skip Controls */}
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <button
                      onClick={() => onSkipTime(-10)}
                      className="text-white/90 hover:text-white control-button"
                      onMouseEnter={() => setShowTooltip("skip-back")}
                      onMouseLeave={() => setShowTooltip("")}
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>
                    <div className={`tooltip ${showTooltip === "skip-back" ? "show" : ""}`}>-10s</div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => onSkipTime(10)}
                      className="text-white/90 hover:text-white control-button"
                      onMouseEnter={() => setShowTooltip("skip-forward")}
                      onMouseLeave={() => setShowTooltip("")}
                    >
                      <SkipForward className="w-6 h-6" />
                    </button>
                    <div className={`tooltip ${showTooltip === "skip-forward" ? "show" : ""}`}>+10s</div>
                  </div>
                </div>

                {/* Volume Control */}
                <div
                  className="flex items-center group relative"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    onClick={onToggleMute}
                    className="text-white/90 hover:text-white control-button p-2 rounded-full hover:bg-white/10"
                  >
                    <VolumeIcon className="w-5 h-5" />
                  </button>

                  <div
                    className={`
                    flex items-center ml-2 transition-all duration-300 ease-out
                    ${showVolumeSlider ? "w-24 opacity-100" : "w-0 opacity-0"}
                  `}
                  >
                    <div className="relative flex items-center w-full">
                      <div className="w-full h-1 bg-white/30 rounded-full">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-150 shadow-sm"
                          style={{ width: `${volume * 100}%` }}
                        />
                      </div>
                      <div
                        className="absolute inset-0 w-full cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setIsVolumeDragging(true)
                          handleVolumeUpdate(e, true)
                        }}
                        onMouseMove={handleVolumeUpdate}
                        onClick={(e) => {
                          if (!isVolumeDragging) {
                            handleVolumeUpdate(e, true)
                          }
                        }}
                      />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="absolute inset-0 w-full opacity-0 pointer-events-none"
                      />
                      <div
                        className={`absolute w-3 h-3 bg-white rounded-full shadow-lg transform -translate-y-1/2 top-1/2 transition-all duration-150 ${
                          isVolumeDragging ? "scale-110" : ""
                        }`}
                        style={{ left: `${volume * 100}%`, transform: `translateX(-50%) translateY(-50%)` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Time Display */}
                <div className="text-white/90 text-sm font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center space-x-3">
                {/* Next Episode */}
                {onNextEpisode && (
                  <div className="relative">
                    <button
                      onClick={onNextEpisode}
                      className="text-white/90 hover:text-red-400 control-button"
                      onMouseEnter={() => setShowTooltip("next")}
                      onMouseLeave={() => setShowTooltip("")}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className={`tooltip ${showTooltip === "next" ? "show" : ""}`}>Épisode suivant</div>
                  </div>
                )}

                {/* Episodes List */}
                {video?.type === "series" && episodes.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowEpisodesPanel(!showEpisodesPanel)}
                      className="text-white/90 hover:text-red-400 control-button"
                      onMouseEnter={() => setShowTooltip("episodes")}
                      onMouseLeave={() => setShowTooltip("")}
                    >
                      <List className="w-6 h-6" />
                    </button>
                    <div className={`tooltip ${showTooltip === "episodes" ? "show" : ""}`}>Liste des épisodes</div>
                  </div>
                )}

                {/* Settings */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-white/90 hover:text-white control-button"
                    onMouseEnter={() => setShowTooltip("settings")}
                    onMouseLeave={() => setShowTooltip("")}
                  >
                    <Settings className="w-6 h-6" />
                  </button>
                  <div className={`tooltip ${showTooltip === "settings" ? "show" : ""}`}>Paramètres</div>

                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden min-w-48 animate-slide-in-up">
                      {/* Playback Speed */}
                      <div className="p-4 border-b border-white/10">
                        <div className="text-white font-medium mb-3 text-sm flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          Vitesse de lecture
                        </div>
                        <div className="space-y-1">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                            <button
                              key={rate}
                              onClick={() => {
                                onPlaybackRateChange(rate)
                                setShowSettings(false)
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                                playbackRate === rate
                                  ? "bg-red-600 text-white shadow-lg"
                                  : "text-gray-300 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {rate}x {rate === 1 ? "(Normal)" : ""}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Subtitles */}
                      {subtitles.length > 0 && (
                        <div className="p-4">
                          <div className="text-white font-medium mb-3 text-sm flex items-center">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Sous-titres
                          </div>
                          <div className="space-y-1">
                            <button
                              onClick={() => {
                                onSubtitleChange(null)
                                setShowSettings(false)
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                                !selectedSubtitle
                                  ? "bg-red-600 text-white shadow-lg"
                                  : "text-gray-300 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              Désactivé
                            </button>
                            {subtitles.map((subtitle) => (
                              <button
                                key={subtitle.id}
                                onClick={() => {
                                  onSubtitleChange(subtitle)
                                  setShowSettings(false)
                                }}
                                className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                                  selectedSubtitle?.id === subtitle.id
                                    ? "bg-red-600 text-white shadow-lg"
                                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {subtitle.languageName}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                <div className="relative">
                  <button
                    onClick={onToggleFullscreen}
                    className="text-white/90 hover:text-white control-button"
                    onMouseEnter={() => setShowTooltip("fullscreen")}
                    onMouseLeave={() => setShowTooltip("")}
                  >
                    {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                  </button>
                  <div className={`tooltip ${showTooltip === "fullscreen" ? "show" : ""}`}>
                    {isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Episodes Panel */}
        {showEpisodesPanel && video?.type === "series" && episodes.length > 0 && (
          <div
            className="absolute bottom-24 right-4 w-96 max-h-96 bg-black/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden z-50 animate-slide-in-right shadow-2xl"
            onMouseLeave={() => setShowEpisodesPanel(false)}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Épisodes</h3>
                <div className="text-gray-400 text-sm">Saison {selectedSeason}</div>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {episodes
                  .filter((episode) => (episode.seasonNumber || 1) === selectedSeason)
                  .map((episode: any, index: number) => (
                    <div
                      key={episode.id}
                      className={`flex items-center space-x-4 p-3 rounded-xl cursor-pointer transition-all duration-300 group ${
                        currentEpisode?.id === episode.id
                          ? "bg-gradient-to-r from-red-500/30 to-red-600/20 border border-red-500/50 shadow-lg"
                          : "hover:bg-white/5 hover:shadow-lg"
                      }`}
                      onClick={() => {
                        if (onPlayEpisode) {
                          onPlayEpisode(episode)
                          setShowEpisodesPanel(false)
                        }
                      }}
                    >
                      <div className="relative overflow-hidden rounded-lg">
                        <img
                          src={
                            episode.thumbnail ||
                            video.thumbnail ||
                            "https://via.placeholder.com/120x68/333/fff?text=Episode" ||
                            "/placeholder.svg"
                          }
                          alt={episode.title}
                          className="w-20 h-12 object-cover episode-thumbnail"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Play className="w-4 h-4 text-white fill-current" />
                        </div>
                        {currentEpisode?.id === episode.id && (
                          <div className="absolute top-1 right-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate mb-1">
                          {index + 1}. {episode.title}
                        </div>
                        <div className="text-gray-400 text-xs flex items-center space-x-2">
                          <span>{episode.duration || "45min"}</span>
                          {episode.rating && (
                            <>
                              <span>•</span>
                              <div className="flex items-center">
                                <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
                                <span>{episode.rating}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default VideoControls
