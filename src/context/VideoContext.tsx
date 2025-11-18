
import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabaseService, Video } from '../services/SupabaseService';

export interface Subtitle {
  id: string;
  language: string;
  languageName: string;
  subtitleUrl: string;
  isDefault: boolean;
}

interface VideoContextType {
  videos: Video[];
  categories: string[];
  getVideoById: (id: string) => Promise<Video | undefined>;
  searchVideos: (query: string) => Promise<Video[]>;
  getVideosByCategory: (category: string) => Video[];
  incrementViews: (videoId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export const VideoProvider = ({ children }: { children: ReactNode }) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<{
    videos: Video[] | null;
    categories: string[] | null;
    lastFetch: number;
    videoCache: Map<string, Video>;
    searchCache: Map<string, Video[]>;
  }>({
    videos: null,
    categories: null,
    lastFetch: 0,
    videoCache: new Map(),
    searchCache: new Map()
  });

  // Cache pendant 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;

  // Helper method to normalize video data
  const normalizeVideo = (video: any): Video => {
    return {
      ...video,
      average_rating: parseFloat(video.average_rating) || 0,
      views: parseInt(video.views) || 0,
      year: parseInt(video.year) || new Date().getFullYear(),
      // Add alias properties for backward compatibility
      averageRating: parseFloat(video.average_rating) || 0,
      totalRatings: parseInt(video.total_ratings) || 0,
      totalSeasons: video.total_seasons,
      totalEpisodes: video.total_episodes,
      createdBy: video.created_by,
      createdAt: video.created_at,
      videoUrl: video.video_url
    };
  };

  const refreshData = async (force: boolean = false) => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    if (isLoading && !force) return;
    
    if (!force && cache.videos && cache.categories && 
        (now - cache.lastFetch) < CACHE_DURATION) {
      setVideos(cache.videos);
      setCategories(cache.categories);
      return;
    }

    setIsLoading(true);
    try {
      const [allVideos, allCategories] = await Promise.all([
        supabaseService.getVideos(),
        supabaseService.getCategories()
      ]);
      
      const normalizedVideos = allVideos.map(normalizeVideo);
      
      cache.videos = normalizedVideos;
      cache.categories = allCategories.map((cat: any) => cat.name);
      cache.lastFetch = now;
      
      setVideos(normalizedVideos);
      setCategories(cache.categories);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement des données:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const getVideoById = async (id: string): Promise<Video | undefined> => {
    const cache = cacheRef.current;
    
    if (cache.videoCache.has(id)) {
      return cache.videoCache.get(id);
    }
    
    const existingVideo = videos.find(v => v.id === id);
    if (existingVideo) {
      cache.videoCache.set(id, existingVideo);
      return existingVideo;
    }
    
    try {
      const video = await supabaseService.getVideo(id);
      if (video) {
        const normalizedVideo = normalizeVideo(video);
        cache.videoCache.set(id, normalizedVideo);
        return normalizedVideo;
      }
      return undefined;
    } catch (error) {
      console.error('Erreur lors de la récupération de la vidéo:', error);
      return undefined;
    }
  };

  const searchVideos = async (query: string): Promise<Video[]> => {
    const cache = cacheRef.current;
    const cacheKey = query.toLowerCase().trim();
    
    if (!cacheKey) return videos;
    
    if (cache.searchCache.has(cacheKey)) {
      return cache.searchCache.get(cacheKey)!;
    }
    
    try {
      const results = await supabaseService.searchVideos(query);
      const normalizedResults = results.map(normalizeVideo);
      
      if (cache.searchCache.size >= 50) {
        const firstKey = cache.searchCache.keys().next().value;
        cache.searchCache.delete(firstKey);
      }
      cache.searchCache.set(cacheKey, normalizedResults);
      
      return normalizedResults;
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      return [];
    }
  };

  const getVideosByCategory = (category: string): Video[] => {
    if (category === 'Tous') return videos;
    return videos.filter(video => video.category === category);
  };

  const incrementViews = async (videoId: string): Promise<void> => {
    try {
      await supabaseService.incrementViews(videoId);
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { 
              ...video, 
              views: video.views + 1,
              // Update alias property too
              ...(video.views !== undefined && { views: video.views + 1 })
            }
          : video
      ));
      
      const cache = cacheRef.current;
      if (cache.videoCache.has(videoId)) {
        const cachedVideo = cache.videoCache.get(videoId)!;
        cache.videoCache.set(videoId, { ...cachedVideo, views: cachedVideo.views + 1 });
      }
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation des vues:', error);
    }
  };

  return (
    <VideoContext.Provider value={{
      videos,
      categories,
      getVideoById,
      searchVideos,
      getVideosByCategory,
      incrementViews,
      refreshData
    }}>
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};

// Re-export Video type for compatibility
export type { Video };
