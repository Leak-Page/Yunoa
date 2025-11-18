import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../services/SupabaseService';

export interface ResumeData {
  episodeId?: string;
  episodeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  progress: number;
  currentTime: number;
}

export const useWatchHistory = (video: any) => {
  const { user } = useAuth();
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load resume data when component mounts
  useEffect(() => {
    const loadResumeData = async () => {
      if (!user || !video) return;

      setIsLoading(true);
      try {
        if (video.type === 'series') {
          // For series, find the last watched episode
          const lastWatched = await supabaseService.getLastWatchedEpisode(user.id, video.id);
          
          if (lastWatched && lastWatched.progress > 0.05 && lastWatched.progress < 0.9) {
            const episode = video.episodes?.find((ep: any) => ep.id === lastWatched.episodeId);
            if (episode) {
              setResumeData({
                episodeId: lastWatched.episodeId,
                episodeTitle: episode.title,
                seasonNumber: episode.seasonNumber || episode.season_number,
                episodeNumber: episode.episodeNumber || episode.episode_number,
                progress: lastWatched.progress,
                currentTime: lastWatched.currentPosition
              });
            }
          }
        } else {
          // For movies, check the single video progress
          const movieProgress = await supabaseService.getLastWatchedPosition(user.id, video.id, null);
          if (movieProgress && movieProgress.progress > 0.05 && movieProgress.progress < 0.9) {
            setResumeData({
              progress: movieProgress.progress,
              currentTime: movieProgress.currentPosition
            });
          }
        }
      } catch (error) {
        console.error('Error loading resume data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResumeData();
  }, [user, video]);

  // Save progress function
  const saveProgress = async (episodeId: string | null, currentTime: number, totalTime: number) => {
    if (!user || !video || currentTime < 10) return;

    const progress = totalTime > 0 ? currentTime / totalTime : 0;

    try {
      await supabaseService.saveWatchHistory(
        user.id,
        video.id,
        episodeId,
        Math.min(progress, 0.95), // Cap at 95% to avoid marking as fully watched
        currentTime,
        totalTime
      );
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // Get saved position for a specific episode or movie
  const getSavedPosition = async (episodeId: string | null = null) => {
    if (!user || !video) return null;

    try {
      return await supabaseService.getLastWatchedPosition(user.id, video.id, episodeId);
    } catch (error) {
      console.error('Error getting saved position:', error);
      return null;
    }
  };

  return {
    resumeData,
    isLoading,
    saveProgress,
    getSavedPosition
  };
};