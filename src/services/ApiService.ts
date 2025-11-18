import { supabaseService } from './SupabaseService';
import { supabase } from '@/integrations/supabase/client';

class ApiService {
  private handleError(error: any) {
    throw new Error(error?.message || JSON.stringify(error));
  }

  // --- Auth ---
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) this.handleError(error);
    return { user: data.user, session: data.session };
  }

  async register(username: string, email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username }
      }
    });
    if (error) this.handleError(error);
    return { user: data.user, session: data.session };
  }

  async verifyToken() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) this.handleError(error);
    return { session };
  }

  async forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) this.handleError(error);
    return { message: 'Email de réinitialisation envoyé' };
  }

  async resetPassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) this.handleError(error);
    return { message: 'Mot de passe mis à jour' };
  }

  // --- Vidéos ---
  async getVideos() {
    return await supabaseService.getVideos();
  }

  async getVideo(id: string) {
    return await supabaseService.getVideo(id);
  }

  async createVideo(videoData: any) {
    return await supabaseService.createVideo(videoData);
  }

  async updateVideo(id: string, videoData: any) {
    return await supabaseService.updateVideo(id, videoData);
  }

  async deleteVideo(id: string) {
    return await supabaseService.deleteVideo(id);
  }

  async incrementViews(videoId: string) {
    return await supabaseService.incrementViews(videoId);
  }

  // --- Proxy vidéo ---
  getVideoProxyUrl(videoUrl: string): string {
    if (videoUrl.startsWith('http')) {
      return `/api/videos/proxy?url=${encodeURIComponent(videoUrl)}`;
    }
    return `/api/videos/proxy?videoId=${videoUrl}`;
  }

  getDirectProxyUrl(url: string): string {
    return `/api/videos/proxy?url=${encodeURIComponent(url)}`;
  }

  // --- Épisodes ---
  async getEpisodes(seriesId: string) {
    return await supabaseService.getEpisodes(seriesId);
  }

  async getEpisode(episodeId: string) {
    return await supabaseService.getEpisode(episodeId);
  }

  async createEpisode(episodeData: any) {
    return await supabaseService.createEpisode(episodeData);
  }

  async updateEpisode(episodeId: string, episodeData: any) {
    return await supabaseService.updateEpisode(episodeId, episodeData);
  }

  async deleteEpisode(episodeId: string) {
    return await supabaseService.deleteEpisode(episodeId);
  }

  // --- Recherche & catégories ---
  async searchVideos(query: string) {
    return await supabaseService.searchVideos(query);
  }

  async getTopRatedVideos(limit: number = 12) {
    const videos = await supabaseService.getVideos();
    return videos
      .sort((a, b) => b.average_rating - a.average_rating)
      .slice(0, limit);
  }

  async getCategories() {
    return await supabaseService.getCategories();
  }

  async createCategory(categoryData: any) {
    return await supabaseService.createCategory(categoryData);
  }

  async updateCategory(id: string, categoryData: any) {
    return await supabaseService.updateCategory(id, categoryData);
  }

  async deleteCategory(id: string) {
    return await supabaseService.deleteCategory(id);
  }

  // --- Favoris ---
  async getFavorites(userId: string) {
    return await supabaseService.getFavorites(userId);
  }

  async addToFavorites(userId: string, videoId: string) {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, video_id: videoId });
    if (error) this.handleError(error);
    return { message: 'Ajouté aux favoris' };
  }

  async removeFromFavorites(userId: string, videoId: string) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('video_id', videoId);
    if (error) this.handleError(error);
    return { message: 'Retiré des favoris' };
  }

  // --- Historique ---
  async getWatchHistory(userId: string) {
    const { data, error } = await supabase
      .from('watch_history')
      .select(`
        *,
        videos:video_id (
          id,
          title,
          thumbnail,
          duration,
          category
        )
      `)
      .eq('user_id', userId)
      .order('watched_at', { ascending: false });
    if (error) this.handleError(error);
    return data || [];
  }

  async addToHistory(userId: string, videoId: string, progress: number) {
    const { error } = await supabase
      .from('watch_history')
      .upsert({ user_id: userId, video_id: videoId, progress });
    if (error) this.handleError(error);
    return { message: 'Ajouté à l\'historique' };
  }

  async saveWatchProgress(watchData: any) {
    const { data, error } = await supabase
      .from('watch_history')
      .upsert({
        user_id: watchData.user_id,
        video_id: watchData.video_id,
        episode_id: watchData.episode_id || null,
        current_position: watchData.current_position,
        progress: watchData.progress,
        total_duration: watchData.total_duration,
        watched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,video_id',
        ignoreDuplicates: false
      });
    
    if (error) this.handleError(error);
    return data;
  }

  // --- Notation ---
  async getUserRating(userId: string, videoId: string) {
    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') this.handleError(error);
    return data?.rating || null;
  }

  async rateVideo(userId: string, videoId: string, rating: number) {
    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: userId, video_id: videoId, rating });
    if (error) this.handleError(error);
    return { message: 'Note enregistrée' };
  }

  // --- Statistiques ---
  async getStats() {
    return await supabaseService.getStats();
  }

  // --- Notifications ---
  async getNotifications(userId: string) {
    return await supabaseService.getNotifications(userId);
  }

  async markNotificationAsRead(notificationId: string) {
    return await supabaseService.markNotificationAsRead(notificationId);
  }

  async markAllNotificationsAsRead(userId: string) {
    return await supabaseService.markAllNotificationsAsRead(userId);
  }

  // --- Sous-titres ---
  async getSubtitles(videoId: string) {
    const { data, error } = await supabase
      .from('subtitles')
      .select('*')
      .or(`video_id.eq.${videoId},episode_id.eq.${videoId}`)
      .order('language');
    
    if (error) this.handleError(error);
    return data || [];
  }

  async addSubtitle(subtitleData: {
    videoId: string;
    episodeId?: string | null;
    language: string;
    languageName: string;
    subtitleUrl: string;
    isDefault: boolean;
  }) {
    const { data, error } = await supabase
      .from('subtitles')
      .insert([{
        video_id: subtitleData.videoId,
        episode_id: subtitleData.episodeId,
        language: subtitleData.language,
        language_name: subtitleData.languageName,
        subtitle_url: subtitleData.subtitleUrl,
        is_default: subtitleData.isDefault
      }]);
    
    if (error) this.handleError(error);
    return data;
  }

  async createSubtitle(subtitleData: any) {
    const { data, error } = await supabase
      .from('subtitles')
      .insert(subtitleData)
      .select()
      .single();
    
    if (error) this.handleError(error);
    return data;
  }

  async uploadSubtitle(videoId: string, formData: FormData) {
    throw new Error('Upload de sous-titres non implémenté avec Supabase');
  }

  async deleteSubtitle(subtitleId: string) {
    const { error } = await supabase
      .from('subtitles')
      .delete()
      .eq('id', subtitleId);
    
    if (error) this.handleError(error);
    return { message: 'Sous-titre supprimé' };
  }

  // --- Utilisateurs ---
  async getUsers() {
    console.log('🔍 Démarrage de getUsers...');
    
    // Méthode principale: Utiliser la fonction RPC
    try {
      console.log('📡 Tentative RPC get_users_with_emails...');
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_users_with_emails');
      
      if (rpcError) {
        console.warn('⚠️ RPC Error:', rpcError);
        // Si l'erreur est liée aux permissions, essayer la version simple
        if (rpcError.message?.includes('Accès refusé')) {
          console.log('🔄 Tentative avec la version simple...');
          const { data: simpleData, error: simpleError } = await (supabase as any).rpc('get_users_with_emails_simple');
          if (!simpleError && simpleData && Array.isArray(simpleData)) {
            console.log('✅ RPC simple réussie, utilisateurs récupérés:', simpleData.length);
            return simpleData.map((user: any) => ({
              ...user,
              createdAt: user.created_at || user.createdAt
            }));
          }
        }
      } else if (rpcData && Array.isArray(rpcData)) {
        console.log('✅ RPC réussie, utilisateurs récupérés:', rpcData.length);
        return rpcData.map((user: any) => ({
          ...user,
          createdAt: user.created_at || user.createdAt
        }));
      }
    } catch (rpcError) {
      console.warn('⚠️ RPC exception:', rpcError);
    }

    // Fallback 1: Essayer avec la fonction edge
    try {
      console.log('🚀 Tentative Edge Function...');
      const { data, error } = await supabase.functions.invoke('admin-users', {
        method: 'GET'
      });
      if (!error && data && Array.isArray(data)) {
        console.log('✅ Edge function réussie');
        return data;
      } else {
        console.warn('⚠️ Edge function error:', error);
      }
    } catch (edgeError) {
      console.warn('⚠️ Edge function exception:', edgeError);
    }

    // Fallback 2: Méthode directe avec les profils seulement
    try {
      console.log('📋 Fallback vers profiles seulement...');
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) this.handleError(profilesError);
      
      console.log('✅ Profils récupérés (sans emails):', profilesData?.length || 0);
      
      // Retourner les profils avec un placeholder pour l'email
      return (profilesData || []).map((profile: any) => ({
        ...profile,
        email: 'Fonction RPC non disponible - Emails masqués',
        createdAt: profile.created_at,
        avatar_url: profile.avatar // Map avatar to avatar_url for compatibility
      }));
      
    } catch (fallbackError) {
      console.error('❌ Erreur dans le fallback getUsers:', fallbackError);
      this.handleError(fallbackError);
    }
  }

  // --- Gestion des bans ---
  async banUser(userId: string, reason: string, duration: string) {
    const banData: any = {
      user_id: userId,
      banned_by: (await supabase.auth.getUser()).data.user?.id,
      reason: reason,
      is_permanent: duration === 'permanent'
    };

    if (duration !== 'permanent') {
      const now = new Date();
      switch (duration) {
        case '1week':
          now.setDate(now.getDate() + 7);
          break;
        case '1month':
          now.setMonth(now.getMonth() + 1);
          break;
        case '1year':
          now.setFullYear(now.getFullYear() + 1);
          break;
      }
      banData.unban_at = now.toISOString();
    }

    const { data, error } = await supabase
      .from('user_bans')
      .insert(banData);
    if (error) this.handleError(error);
    return data;
  }

  async unbanUser(userId: string) {
    const { data, error } = await supabase
      .from('user_bans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) this.handleError(error);
    return data;
  }

  async getUserBanStatus(userId: string) {
    const { data, error } = await (supabase as any).rpc('is_user_banned', { user_uuid: userId });
    if (error) this.handleError(error);
    return data?.[0] || null;
  }

  // --- Gestion des abonnements ---
  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') this.handleError(error);
    return data;
  }

  async suspendUserSubscription(userId: string, reason: string) {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return null;

    // Calculer les jours restants
    const endDate = new Date(subscription.subscription_end);
    const now = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const { data, error } = await supabase
      .from('subscription_suspensions')
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        suspended_by: (await supabase.auth.getUser()).data.user?.id,
        reason: reason,
        days_remaining: daysRemaining,
        original_end_date: subscription.subscription_end
      });

    if (error) this.handleError(error);
    return data;
  }

  async resumeUserSubscription(userId: string) {
    const { data: suspension, error: suspensionError } = await supabase
      .from('subscription_suspensions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (suspensionError) this.handleError(suspensionError);

    if (suspension) {
      // Reprendre l'abonnement avec les jours restants
      const now = new Date();
      const newEndDate = new Date(now.getTime() + (suspension.days_remaining * 24 * 60 * 60 * 1000));

      const { error: updateError } = await supabase
        .from('subscribers')
        .update({ subscription_end: newEndDate.toISOString() })
        .eq('user_id', userId);

      if (updateError) this.handleError(updateError);

      // Désactiver la suspension
      const { error: deactivateError } = await supabase
        .from('subscription_suspensions')
        .update({ is_active: false })
        .eq('id', suspension.id);

      if (deactivateError) this.handleError(deactivateError);
    }
  }

  // --- Vues par utilisateur ---
  async recordUserView(videoId: string, userId?: string) {
    if (!userId) return;

    const { error } = await supabase
      .from('user_video_views')
      .insert({
        user_id: userId,
        video_id: videoId,
        ip_address: null, // Peut être ajouté si nécessaire
        user_agent: navigator.userAgent
      });

    // Ignorer les erreurs de doublon (contrainte unique)
    if (error && error.code !== '23505') {
      console.error('Erreur lors de l\'enregistrement de la vue:', error);
    }
  }

  async updateUser(id: string, userData: any) {
    // Filtrer les champs pour ne garder que ceux de la table profiles
    const profileData = {
      username: userData.username,
      role: userData.role,
      avatar: userData.avatar
    };
    
    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', id);
    if (error) this.handleError(error);
    return data;
  }

  async deleteUser(id: string) {
    try {
      // Essayer d'abord avec la fonction edge
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: id }
      });
      if (!error) {
        return data || { message: 'Utilisateur supprimé' };
      }
    } catch (edgeError) {
      console.warn('Edge function échouée pour deleteUser, fallback:', edgeError);
    }

    // Fallback vers suppression directe du profil
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (error) this.handleError(error);
    return { message: 'Utilisateur supprimé' };
  }

  // --- Statistiques utilisateur ---
  async getUserStats(userId: string) {
    const [favorites, history] = await Promise.all([
      this.getFavorites(userId),
      this.getWatchHistory(userId),
    ]);
    return {
      totalFavorites: favorites.length,
      totalWatched: history.length,
      totalRatings: 0, // Placeholder
      totalHours: 0,   // Placeholder
    };
  }

  async getUserActivity(userId: string, limit: number = 10) {
    const history = await this.getWatchHistory(userId);
    return history.slice(0, limit).map((item: any) => ({
      type: 'watch' as const,
      date: item.watched_at,
      videoId: item.video_id,
      title: item.videos?.title || 'Titre inconnu',
      thumbnail: item.videos?.thumbnail || '',
      category: item.videos?.category || '',
      averageRating: 0, // Placeholder
      videoType: 'movie', // Placeholder
      userRating: undefined,
    }));
  }

  async getUnreadNotifications(userId: string) {
    const notifications = await this.getNotifications(userId);
    return notifications.filter((n: any) => !n.is_read);
  }

  async sendNotification(userId: string, title: string, message: string) {
    const { error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, title, message });
    if (error) this.handleError(error);
    return { message: 'Notification envoyée' };
  }

  async sendNotificationToAll(title: string, message: string) {
    const users = await this.getUsers();
    // Add type checking to ensure users is an array
    if (!Array.isArray(users)) {
      throw new Error('Unable to retrieve users list');
    }
    
    const notifications = users.map((user: any) => ({
      user_id: user.id,
      title,
      message,
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) this.handleError(error);
    return { message: `Notification envoyée à ${users.length} utilisateurs` };
  }

  // Get all notifications (admin only)
  async getAllNotifications(): Promise<any[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all notifications:', error);
      throw error;
    }

    return data || [];
  }

  // Delete notification (admin only)
  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Update notification (admin only)
  async updateNotification(notificationId: string, data: { title: string; message: string }): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({
        title: data.title,
        message: data.message
      })
      .eq('id', notificationId);

    if (error) {
      console.error('Error updating notification:', error);
      throw error;
    }
  }

  async sendDiscordWebhook(data: any) {
    const { data: response, error } = await supabase.functions.invoke('discord-webhook', {
      body: data
    });
    if (error) this.handleError(error);
    return response;
  }

  async sendVerificationCode(email: string) {
    return this.forgotPassword(email);
  }

  async verifyEmailCode(email: string, code: string) {
    throw new Error('Vérification par code non implémentée avec Supabase');
  }

  async request(url: string, options: any) {
    const method = options.method || 'GET';
    const body = options.body;

    const urlParts = url.split('?');
    const query = new URLSearchParams(urlParts[1] || '');
    const route = query.get('route');

    if (url.includes('/auth')) {
      if (route === 'send-code') {
        const { email } = JSON.parse(body);
        return this.sendVerificationCode(email);
      }
      if (route === 'verify-code') {
        const { email, code } = JSON.parse(body);
        return this.verifyEmailCode(email, code);
      }
    }

    throw new Error(`Route non implémentée: ${url}`);
  }
}

export const apiService = new ApiService();