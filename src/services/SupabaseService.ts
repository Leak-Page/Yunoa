
import { supabase } from '@/integrations/supabase/client';

export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  video_url: string;
  duration: string;
  category: string;
  language: string;
  year: number;
  views: number;
  average_rating: number;
  total_ratings: number;
  type: 'movie' | 'series';
  total_seasons?: number;
  total_episodes?: number;
  created_by: string;
  created_at: string;
  episodes?: Episode[];
  subtitles?: Subtitle[];
  // Alias properties for backward compatibility
  videoUrl?: string;
  averageRating?: number;
  totalRatings?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  createdBy?: string;
  createdAt?: string;
}

export interface Episode {
  id: string;
  series_id: string;
  title: string;
  description: string;
  episode_number: number;
  season_number: number;
  video_url: string;
  thumbnail: string;
  duration: string;
  views: number;
  created_at: string;
  updated_at: string;
  // Alias properties for backward compatibility
  episodeNumber?: number;
  seasonNumber?: number;
  videoUrl?: string;
}

export interface Subtitle {
  id: string;
  language: string;
  languageName: string;
  subtitleUrl: string;
  isDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
}

class SupabaseService {
  // Expose supabase client for direct access
  public supabase = supabase;
  // Helper method to normalize video data
  private normalizeVideo(video: any): Video {
    return {
      ...video,
      // Add alias properties for backward compatibility
      videoUrl: video.video_url,
      averageRating: video.average_rating,
      totalRatings: video.total_ratings,
      totalSeasons: video.total_seasons,
      totalEpisodes: video.total_episodes,
      createdBy: video.created_by,
      createdAt: video.created_at,
    };
  }

  // Helper method to normalize episode data
  private normalizeEpisode(episode: any): Episode {
    return {
      ...episode,
      // Add alias properties for backward compatibility
      episodeNumber: episode.episode_number,
      seasonNumber: episode.season_number,
      videoUrl: episode.video_url,
    };
  }

  // Videos
  async getVideos(): Promise<Video[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const videos = (data || []).map(video => this.normalizeVideo(video));
    
    // Load episodes for all series
    const videosWithEpisodes = await Promise.all(
      videos.map(async (video) => {
        if (video.type === 'series') {
          try {
            video.episodes = await this.getEpisodes(video.id);
          } catch (error) {
            console.error('Error loading episodes for video:', video.id, error);
            video.episodes = [];
          }
        }
        return video;
      })
    );
    
    return videosWithEpisodes;
  }

  async getVideo(id: string): Promise<Video | null> {
    // First try to get it as a video
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (videoData) {
      const video = this.normalizeVideo(videoData);
      
      // Load episodes if it's a series
      if (video.type === 'series') {
        try {
          video.episodes = await this.getEpisodes(id);
        } catch (error) {
          console.error('Error loading episodes for video:', error);
          video.episodes = [];
        }
      }
      
      return video;
    }

    // If not found as video, check if it's an episode ID
    const { data: episodeData, error: episodeError } = await supabase
      .from('episodes')
      .select('*, videos!series_id(*)')
      .eq('id', id)
      .maybeSingle();

    if (episodeData && episodeData.videos) {
      // Return the parent series video instead
      const video = this.normalizeVideo(episodeData.videos);
      if (video.type === 'series') {
        try {
          video.episodes = await this.getEpisodes(video.id);
        } catch (error) {
          console.error('Error loading episodes for video:', error);
          video.episodes = [];
        }
      }
      return video;
    }

    // Not found
    return null;
  }

  async createVideo(videoData: Omit<Video, 'id' | 'created_at' | 'views' | 'average_rating' | 'total_ratings'>): Promise<Video> {
    const { data, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .single();

    if (error) throw error;
    return this.normalizeVideo(data);
  }

  async updateVideo(id: string, videoData: Partial<Video>): Promise<Video> {
    const { data, error } = await supabase
      .from('videos')
      .update(videoData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    
    if (!data) {
      throw new Error('Video not found or you do not have permission to update it');
    }
    
    return this.normalizeVideo(data);
  }

  async deleteVideo(id: string): Promise<void> {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async incrementViews(videoId: string): Promise<void> {
    // Fallback to manual increment since RPC function might not exist
    const { data: video } = await supabase
      .from('videos')
      .select('views')
      .eq('id', videoId)
      .single();

    if (video) {
      await supabase
        .from('videos')
        .update({ views: video.views + 1 })
        .eq('id', videoId);
    }
  }

  async searchVideos(query: string): Promise<Video[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .or(`title.ilike.%${query}%, description.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(video => this.normalizeVideo(video));
  }

  // Episodes
  async getEpisodes(seriesId: string): Promise<Episode[]> {
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', seriesId)
      .order('season_number', { ascending: true })
      .order('episode_number', { ascending: true });

    if (error) throw error;
    return (data || []).map(episode => this.normalizeEpisode(episode));
  }

  async getEpisode(episodeId: string): Promise<Episode | null> {
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async createEpisode(episodeData: Omit<Episode, 'id' | 'views' | 'created_at' | 'updated_at'>): Promise<Episode> {
    const { data, error } = await supabase
      .from('episodes')
      .insert(episodeData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateEpisode(id: string, episodeData: Partial<Episode>): Promise<Episode> {
    const { data, error } = await supabase
      .from('episodes')
      .update(episodeData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteEpisode(id: string): Promise<void> {
    const { error } = await supabase
      .from('episodes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createCategory(categoryData: Omit<Category, 'id' | 'created_at'>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCategory(id: string, categoryData: Partial<Category>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update(categoryData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Favorites
  async getFavorites(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        *,
        videos:video_id (
          id,
          title,
          thumbnail,
          category,
          year,
          average_rating
        )
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Notifications
  async getNotifications(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Map created_at to createdAt and is_read to isRead for frontend consistency
    return (data || []).map(notification => ({
      ...notification,
      createdAt: notification.created_at,
      isRead: notification.is_read
    }));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) throw error;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw error;
  }

  // Watch History
  async getWatchHistory(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('watch_history')
      .select(`
        *,
        videos:video_id (
          id,
          title,
          thumbnail,
          category,
          year,
          average_rating,
          type,
          duration
        ),
        episodes:episode_id (
          id,
          title,
          episode_number,
          season_number
        )
      `)
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    return (data || []).map(entry => ({
      id: entry.id,
      videoId: entry.video_id,
      episodeId: entry.episode_id,
      progress: parseFloat(String(entry.progress || '0')),
      currentPosition: entry.current_position,
      totalDuration: entry.total_duration,
      lastWatched: entry.watched_at,
      title: entry.videos?.title || 'Titre inconnu',
      thumbnail: entry.videos?.thumbnail,
      category: entry.videos?.category,
      year: entry.videos?.year,
      rating: entry.videos?.average_rating,
      type: entry.videos?.type || 'movie',
      duration: entry.videos?.duration,
      episodeTitle: entry.episodes?.title,
      episodeNumber: entry.episodes?.episode_number,
      seasonNumber: entry.episodes?.season_number
    }));
  }

  async saveWatchHistory(userId: string, videoId: string, episodeId: string | null, progress: number, currentPosition: number, totalDuration?: number): Promise<void> {
    const { error } = await supabase
      .from('watch_history')
      .upsert({
        user_id: userId,
        video_id: videoId,
        episode_id: episodeId,
        progress: Math.max(0, Math.min(1, progress)),
        current_position: Math.max(0, currentPosition),
        total_duration: totalDuration,
        watched_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,video_id,episode_id'
      });

    if (error) throw error;
  }

  async getLastWatchedPosition(userId: string, videoId: string, episodeId: string | null): Promise<{ progress: number; currentPosition: number; episodeId?: string } | null> {
    let query = supabase
      .from('watch_history')
      .select('progress, current_position, episode_id')
      .eq('user_id', userId)
      .eq('video_id', videoId);
    
    if (episodeId) {
      query = query.eq('episode_id', episodeId);
    } else {
      query = query.is('episode_id', null);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    
    if (data) {
      return {
        progress: parseFloat(String(data.progress || '0')),
        currentPosition: data.current_position,
        episodeId: data.episode_id
      };
    }
    
    return null;
  }

  async getLastWatchedEpisode(userId: string, videoId: string): Promise<{ episodeId: string; progress: number; currentPosition: number } | null> {
    const { data, error } = await supabase
      .from('watch_history')
      .select('episode_id, progress, current_position')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .not('episode_id', 'is', null)
      .order('watched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    
    if (data) {
      return {
        episodeId: data.episode_id,
        progress: parseFloat(String(data.progress || '0')),
        currentPosition: data.current_position
      };
    }
    
    return null;
  }

  // Stats
  async getStats(): Promise<any> {
    const [
      { count: totalVideos },
      { count: totalUsers },
      { count: totalCategories }
    ] = await Promise.all([
      supabase.from('videos').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('categories').select('*', { count: 'exact', head: true })
    ]);

    return {
      totalVideos: totalVideos || 0,
      totalUsers: totalUsers || 0,
      totalCategories: totalCategories || 0,
    };
  }
}

export const supabaseService = new SupabaseService();
