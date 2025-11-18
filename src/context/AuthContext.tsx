
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'membre' | 'admin';
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  favorites: string[];
  addToFavorites: (videoId: string) => Promise<void>;
  removeFromFavorites: (videoId: string) => Promise<void>;
  rateVideo: (videoId: string, rating: number) => Promise<void>;
  getUserRating: (videoId: string) => Promise<number | null>;
  addToHistory: (videoId: string, progress: number) => Promise<void>;
  getWatchHistory: () => Promise<any[]>;
  isLoading: boolean;
  isAuthLoading: boolean;
  error: string | null;
  clearError: () => void;
  notifications: any[];
  unreadCount: number;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        
        if (session?.user) {
          loadUserProfile(session.user).then(() => {
            if (mounted) {
              setTimeout(() => {
                loadFavorites(session.user.id);
                loadNotifications(session.user.id);
              }, 100);
            }
          });
        } else {
          setUser(null);
          setFavorites([]);
          setNotifications([]);
          setUnreadCount(0);
        }
        
        if (mounted) {
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('Initial session check:', session?.user?.id, error);
        
        if (!mounted) return;
        
        setSession(session);
        if (session?.user) {
          await loadUserProfile(session.user);
          setTimeout(() => {
            if (mounted) {
              loadFavorites(session.user.id);
              loadNotifications(session.user.id);
            }
          }, 100);
        }
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser: User) => {
    try {
      console.log('Loading profile for user:', authUser.id);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      if (!profile) {
        console.log('Profile not found, creating new profile');
        // Si le profil n'existe pas, on le crée
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'utilisateur',
            role: 'membre'
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('Error creating profile:', insertError);
          return;
        }
        
        if (newProfile) {
          console.log('Profile created successfully:', newProfile);
          setUser({
            id: authUser.id,
            username: newProfile.username,
            email: authUser.email!,
            avatar: newProfile.avatar,
            role: (newProfile.role as 'membre' | 'admin') || 'membre',
            createdAt: newProfile.created_at
          });
        }
        return;
      }

      console.log('Profile loaded successfully:', profile);
      setUser({
        id: authUser.id,
        username: profile.username,
        email: authUser.email!,
        avatar: profile.avatar,
        role: (profile.role as 'membre' | 'admin') || 'membre',
        createdAt: profile.created_at
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadFavorites = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('video_id')
        .eq('user_id', userId);

      if (error) {
        console.error('Error loading favorites:', error);
        return;
      }

      setFavorites(data.map(f => f.video_id));
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setIsAuthLoading(false);
        return false;
      }

      if (data.user) {
        toast({
          title: "Connexion réussie",
          description: "Bienvenue !",
        });
        
        setIsAuthLoading(false);
        return true;
      }

      setIsAuthLoading(false);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setError('Erreur de connexion');
      setIsAuthLoading(false);
      return false;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsAuthLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: username,
          }
        }
      });

      if (error) {
        setError(error.message);
        return false;
      }

      toast({
        title: "Compte créé avec succès",
        description: "Bienvenue sur Yunoa !",
      });

      return true;
    } catch (error) {
      console.error('Register error:', error);
      setError('Erreur d\'inscription');
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Nettoyer le state local d'abord
      setUser(null);
      setSession(null);
      setFavorites([]);
      setNotifications([]);
      setUnreadCount(0);
      
      // Nettoyer le localStorage des clés Supabase
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      // Puis déconnecter de Supabase
      await supabase.auth.signOut({ scope: 'global' });
      
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Même en cas d'erreur, on force la déconnexion côté client
      setUser(null);
      setSession(null);
      setFavorites([]);
      setNotifications([]);
      setUnreadCount(0);
      
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });
    }
  };

  const updateProfile = async (data: Partial<AuthUser>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          avatar: data.avatar,
        })
        .eq('id', user.id);

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le profil",
          variant: "destructive"
        });
        return;
      }

      setUser({ ...user, ...data });
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été sauvegardées",
      });
    } catch (error) {
      console.error('Update profile error:', error);
    }
  };

  const addToFavorites = async (videoId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          video_id: videoId,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Déjà en favoris",
            description: "Cette vidéo est déjà dans vos favoris",
          });
          return;
        }
        throw error;
      }

      setFavorites(prev => [...prev, videoId]);
      toast({
        title: "Ajouté aux favoris",
        description: "La vidéo a été ajoutée à vos favoris",
      });
    } catch (error) {
      console.error('Add to favorites error:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter aux favoris",
        variant: "destructive"
      });
    }
  };

  const removeFromFavorites = async (videoId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('video_id', videoId);

      if (error) throw error;

      setFavorites(prev => prev.filter(id => id !== videoId));
      toast({
        title: "Retiré des favoris",
        description: "La vidéo a été retirée de vos favoris",
      });
    } catch (error) {
      console.error('Remove from favorites error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de retirer des favoris",
        variant: "destructive"
      });
    }
  };

  const rateVideo = async (videoId: string, rating: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('ratings')
        .upsert({
          user_id: user.id,
          video_id: videoId,
          rating: rating,
        });

      if (error) throw error;

      toast({
        title: "Note enregistrée",
        description: `Vous avez noté cette vidéo ${rating}/5`,
      });
    } catch (error) {
      console.error('Rate video error:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la note",
        variant: "destructive"
      });
    }
  };

  const getUserRating = async (videoId: string): Promise<number | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data?.rating || null;
    } catch (error) {
      console.error('Get user rating error:', error);
      return null;
    }
  };

  const addToHistory = async (videoId: string, progress: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('watch_history')
        .upsert({
          user_id: user.id,
          video_id: videoId,
          progress: progress,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Add to history error:', error);
    }
  };

  const getWatchHistory = async (): Promise<any[]> => {
    if (!user) return [];

    try {
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
        .eq('user_id', user.id)
        .order('watched_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Get watch history error:', error);
      return [];
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Mark notification as read error:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      login,
      register,
      logout,
      updateProfile,
      favorites,
      addToFavorites,
      removeFromFavorites,
      rateVideo,
      getUserRating,
      addToHistory,
      getWatchHistory,
      isLoading,
      isAuthLoading,
      error,
      clearError,
      notifications,
      unreadCount,
      markNotificationAsRead,
      markAllNotificationsAsRead
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
