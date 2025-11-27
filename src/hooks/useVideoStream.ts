import { useState, useEffect, useRef, useCallback } from 'react';
import { videoStreamService, BufferState, VideoQuality } from '../services/VideoStreamService';
import { VideoSecurityManager } from '../utils/videoSecurity';
import { useAuth } from '../context/AuthContext';

export interface UseVideoStreamOptions {
  videoId: string;
  url: string;
  autoQuality?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  onBufferUpdate?: (state: BufferState) => void;
  onQualityChange?: (quality: VideoQuality) => void;
  onError?: (error: Error) => void;
}

export interface VideoStreamState {
  isLoading: boolean;
  isBuffering: boolean;
  bufferHealth: 'good' | 'warning' | 'critical';
  currentQuality: VideoQuality | null;
  availableQualities: VideoQuality[];
  networkSpeed: number;
  bufferPercentage: number;
  error: Error | null;
}

export const useVideoStream = (options: UseVideoStreamOptions) => {
  const {
    videoId,
    url,
    autoQuality = true,
    preload = 'metadata',
    onBufferUpdate,
    onQualityChange,
    onError
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const loaderRef = useRef<{ abort: () => void } | null>(null);
  const securityManagerRef = useRef<VideoSecurityManager | null>(null);
  const { session } = useAuth();
  
  const [state, setState] = useState<VideoStreamState>({
    isLoading: false,
    isBuffering: false,
    bufferHealth: 'good',
    currentQuality: null,
    availableQualities: [],
    networkSpeed: 0,
    bufferPercentage: 0,
    error: null
  });

  // Initialize video stream
  const initializeStream = useCallback(async () => {
    if (!videoRef.current || !url || !session) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Initialize security manager if not already done
      if (!securityManagerRef.current) {
        securityManagerRef.current = new VideoSecurityManager();
      }

      // Load video securely using micro-chunks
      const sessionToken = session.access_token;
      const blobUrl = await securityManagerRef.current.loadSecureVideo({
        videoUrl: url,
        videoId: videoId,
        sessionToken,
        onProgress: (progress) => {
          setState(prev => ({ ...prev, bufferPercentage: progress }));
        }
      });

      // For now, create a single quality option
      const qualities: VideoQuality[] = [
        {
          label: 'Sécurisé',
          url: blobUrl,
          bitrate: 2000,
          resolution: '720p'
        }
      ];

      let selectedQuality: VideoQuality;
      
      if (autoQuality) {
        selectedQuality = await videoStreamService.getOptimalQuality(qualities);
      } else {
        selectedQuality = qualities[0];
      }

      setState(prev => ({
        ...prev,
        availableQualities: qualities,
        currentQuality: selectedQuality,
        isLoading: false
      }));

      // Set video source with secure blob URL
      videoRef.current.src = blobUrl;

      // Start buffer monitoring
      videoStreamService.createBufferMonitor(videoRef.current, videoId);

      // Handle buffer updates
      const handleBufferUpdate = (event: CustomEvent<BufferState>) => {
        const bufferState = event.detail;
        setState(prev => ({
          ...prev,
          isBuffering: bufferState.loading,
          bufferHealth: bufferState.health,
          networkSpeed: bufferState.networkSpeed,
          bufferPercentage: bufferState.buffered
        }));
        onBufferUpdate?.(bufferState);
      };

      videoRef.current.addEventListener('bufferUpdate', handleBufferUpdate as EventListener);

      onQualityChange?.(selectedQuality);

    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, error: err, isLoading: false }));
      onError?.(err);
    }
  }, [videoId, url, autoQuality, preload, session, onBufferUpdate, onQualityChange, onError]);

  // Change quality manually
  const changeQuality = useCallback(async (quality: VideoQuality) => {
    if (!videoRef.current) return;

    const currentTime = videoRef.current.currentTime;
    const wasPlaying = !videoRef.current.paused;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      videoRef.current.src = quality.url;
      
      // Restore position
      videoRef.current.addEventListener('loadedmetadata', () => {
        if (videoRef.current) {
          videoRef.current.currentTime = currentTime;
          if (wasPlaying) {
            videoRef.current.play();
          }
        }
      }, { once: true });

      setState(prev => ({
        ...prev,
        currentQuality: quality,
        isLoading: false
      }));

      onQualityChange?.(quality);

    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, error: err, isLoading: false }));
      onError?.(err);
    }
  }, [onQualityChange, onError]);

  // Progressive loading with progress
  const loadWithProgress = useCallback(async (onProgress?: (loaded: number, total: number) => void) => {
    if (!url) return;

    // Cancel previous loader
    if (loaderRef.current) {
      loaderRef.current.abort();
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const loader = videoStreamService.createProgressiveLoader(url, onProgress);
      loaderRef.current = loader;

      const buffer = await loader.load();
      
      // Create blob URL for smooth playback
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      
      if (videoRef.current) {
        videoRef.current.src = blobUrl;
      }

      setState(prev => ({ ...prev, isLoading: false }));

    } catch (error) {
      if (error.name !== 'AbortError') {
        const err = error as Error;
        setState(prev => ({ ...prev, error: err, isLoading: false }));
        onError?.(err);
      }
    }
  }, [url, onError]);

  // Abort loading
  const abortLoading = useCallback(() => {
    if (loaderRef.current) {
      loaderRef.current.abort();
      loaderRef.current = null;
    }
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  // Auto-initialize when options change
  useEffect(() => {
    if (videoId && url) {
      initializeStream();
    }
  }, [initializeStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (securityManagerRef.current) {
        securityManagerRef.current.cleanup();
      }
      if (loaderRef.current) {
        loaderRef.current.abort();
      }
    };
  }, []);

  return {
    videoRef,
    state,
    initializeStream,
    changeQuality,
    loadWithProgress,
    abortLoading
  };
};