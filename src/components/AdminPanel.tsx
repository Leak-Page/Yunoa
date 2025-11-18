import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVideo, Video } from '../context/VideoContext';
import { apiService } from '../services/ApiService';
import { useToast } from '../hooks/use-toast';
import { Plus, Edit3 as Edit, Trash2, Users, Video as VideoIcon, Film, Grid, BarChart, Settings, Upload, Search, Filter, Shield, Star, Eye, X, Save, PlayCircle, Bell, Send, UserCog } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { UserManagementModal } from './UserManagementModal';
import Header from './Header';

interface Episode {
  id?: string;
  title: string;
  description: string;
  videoUrl?: string;
  thumbnail?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  duration?: string;
}

interface AdminStats {
  totalVideos: number;
  totalUsers: number;
  totalViews: number;
  recentVideos: number;
  recentUsers: number;
}

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  videoCount: number;
}

const AdminPanel = () => {
  // ALL HOOKS MUST BE DECLARED AT THE TOP - NEVER CONDITIONALLY
  const [activeTab, setActiveTab] = useState('videos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [selectedUserForManagement, setSelectedUserForManagement] = useState<any>(null);
  const [currentVideoForSubtitle, setCurrentVideoForSubtitle] = useState<any>(null);
  const [currentEpisodeForSubtitle, setCurrentEpisodeForSubtitle] = useState<any>(null);
  const [currentVideoSubtitles, setCurrentVideoSubtitles] = useState<any[]>([]);
  const [showSubtitlesList, setShowSubtitlesList] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [existingEpisodes, setExistingEpisodes] = useState<Episode[]>([]);
  
  const [stats, setStats] = useState<AdminStats>({
    totalVideos: 0,
    totalUsers: 0,
    totalViews: 0,
    recentVideos: 0,
    recentUsers: 0
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail: '',
    videoUrl: '',
    category: '',
    language: 'Français',
    year: new Date().getFullYear(),
    duration: '',
    createdBy: '',
    type: 'movie' as 'movie' | 'series',
    totalSeasons: 1,
    episodes: [] as Episode[]
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#e74c3c'
  });

  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    role: 'user' as 'admin' | 'user'
  });

  const [subscriptionFormData, setSubscriptionFormData] = useState({
    selectedUserId: '',
    planCode: 'essentiel' as 'essentiel' | 'premium' | 'lifetime',
    durationMonths: 1
  });
  const [subtitleForm, setSubtitleForm] = useState({
    language: '',
    languageName: '',
    subtitleUrl: '',
    isDefault: false
  });

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const [notificationFormData, setNotificationFormData] = useState({
    title: '',
    message: '',
    sendToAll: true,
    selectedUserId: ''
  });

  const [allNotifications, setAllNotifications] = useState<any[]>([]);
  const [editingNotification, setEditingNotification] = useState<any>(null);
  const [showEditNotificationModal, setShowEditNotificationModal] = useState(false);
  const [selectedUserNotifications, setSelectedUserNotifications] = useState<any>(null);
  const [showUserNotificationsModal, setShowUserNotificationsModal] = useState(false);

  // Context hooks - must be called unconditionally
  const { user } = useAuth();
  const { refreshData } = useVideo();
  const { toast } = useToast();

  // Define loadData function before useEffect
  const loadData = async () => {
    try {
      setLoading(true);
      const [videosData, categoriesData, usersData, statsData] = await Promise.all([
        apiService.getVideos(),
        apiService.getCategories(),
        apiService.getUsers(),
        apiService.getStats()
      ]);
      
      // Normalize video data to ensure averageRating is always a number
      const normalizedVideos = videosData.map((video: any) => ({
        ...video,
        averageRating: parseFloat(video.averageRating) || 0,
        views: parseInt(video.views) || 0,
        year: parseInt(video.year) || new Date().getFullYear(),
        totalRatings: parseInt(video.totalRatings) || 0
      }));
      
      setVideos(normalizedVideos);
      
      // Handle categories - ensure they are properly formatted
      const formattedCategories = Array.isArray(categoriesData) 
        ? categoriesData.map((cat: any) => {
            // If it's already a string, convert to object format
            if (typeof cat === 'string') {
              return {
                id: cat,
                name: cat,
                description: '',
                color: '#e74c3c',
                createdAt: new Date().toISOString(),
                videoCount: normalizedVideos.filter((v: any) => v.category === cat).length
              };
            }
            // If it's an object, ensure it has all required properties
            return {
              id: cat.id || cat.name || cat,
              name: cat.name || cat,
              description: cat.description || '',
              color: cat.color || '#e74c3c',
              createdAt: cat.createdAt || new Date().toISOString(),
              videoCount: cat.videoCount || normalizedVideos.filter((v: any) => v.category === (cat.name || cat)).length
            };
          })
        : [];
      
      setCategories(formattedCategories);
      setUsers(usersData);
      setStats({
        totalVideos: normalizedVideos.length,
        totalUsers: usersData.length,
        totalViews: normalizedVideos.reduce((sum: number, video: any) => sum + (video.views || 0), 0),
        recentVideos: normalizedVideos.filter((video: any) => {
          const videoDate = new Date(video.createdAt);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return videoDate > weekAgo;
        }).length,
        recentUsers: usersData.filter((user: any) => {
          const userDate = new Date(user.createdAt);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return userDate > weekAgo;
        }).length
      });
      
      // Load all notifications for admin management
      await loadAllNotifications();
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllNotifications = async () => {
    try {
      const response = await apiService.getAllNotifications();
      // Make sure the response is an array
      setAllNotifications(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
      setAllNotifications([]); // Set empty array on error
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette notification ?')) {
      return;
    }
    
    try {
      await apiService.deleteNotification(notificationId);
      toast({
        title: "Succès",
        description: "Notification supprimée avec succès",
      });
      loadAllNotifications();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la notification",
        variant: "destructive",
      });
    }
  };

  const handleEditNotification = (notification: any) => {
    setEditingNotification(notification);
    setNotificationFormData({
      title: notification.title,
      message: notification.message,
      sendToAll: false,
      selectedUserId: notification.user_id
    });
    setShowEditNotificationModal(true);
  };

  const handleUpdateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotification) return;
    
    try {
      await apiService.updateNotification(editingNotification.id, {
        title: notificationFormData.title,
        message: notificationFormData.message
      });
      
      toast({
        title: "Succès",
        description: "Notification modifiée avec succès",
      });
      setShowEditNotificationModal(false);
      setEditingNotification(null);
      resetNotificationForm();
      loadAllNotifications();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la notification",
        variant: "destructive",
      });
    }
  };

  const formatNotificationDate = (dateString: string, hasBeenEdited: boolean = false) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    const formattedDate = date.toLocaleDateString('fr-FR', options);
    return hasBeenEdited ? `${formattedDate} (modifié)` : formattedDate;
  };

  // Effects - must be called unconditionally
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        createdBy: user.id
      }));
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, []);

  // NOW check for authentication AFTER all hooks are declared
if (!user || user.role !== 'admin') {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Accès refusé</h1>
        <p className="text-gray-400">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>
      </div>
    </div>
  );
}


  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare video data for creation
      const videoData = {
        title: formData.title,
        description: formData.description,
        thumbnail: formData.thumbnail,
        video_url: formData.type === 'movie' ? formData.videoUrl : '',
        category: formData.category,
        language: formData.language,
        year: formData.year,
        duration: formData.duration,
        created_by: formData.createdBy,
        type: formData.type,
        total_seasons: formData.type === 'series' ? formData.totalSeasons : null,
        total_episodes: formData.type === 'series' ? formData.episodes.length : null
      };

      // Create the video first
      const createdVideo = await apiService.createVideo(videoData);
      
      // Send Discord webhook only for movies and series (not episodes)
      if (formData.type === 'movie' || formData.type === 'series') {
        try {
          await apiService.sendDiscordWebhook({
            type: formData.type,
            title: formData.title,
            category: formData.category,
            addedBy: user?.username || 'Admin',
            videoUrl: createdVideo.id,
            thumbnail: formData.thumbnail
          });
        } catch (webhookError) {
          console.error('Discord webhook failed:', webhookError);
        }
      }
      
      // If it's a series, create episodes separately
      if (formData.type === 'series' && formData.episodes.length > 0) {
        for (const episode of formData.episodes) {
          const createdEpisode = await apiService.createEpisode({
            series_id: createdVideo.id,
            title: episode.title,
            description: episode.description,
            episode_number: episode.episodeNumber,
            season_number: episode.seasonNumber,
            video_url: episode.videoUrl,
            thumbnail: episode.thumbnail,
            duration: episode.duration
          });

          // Send Discord webhook for episode
          try {
            await apiService.sendDiscordWebhook({
              type: 'episode',
              title: episode.title,
              seriesTitle: formData.title,
              category: formData.category,
              addedBy: user?.username || 'Admin',
              videoUrl: createdVideo.id,
              thumbnail: episode.thumbnail || formData.thumbnail,
              episodeNumber: episode.episodeNumber,
              seasonNumber: episode.seasonNumber
            });
          } catch (webhookError) {
            console.error('Discord webhook failed for episode:', webhookError);
          }
        }
      }

      toast({
        title: "Succès",
        description: formData.type === 'series' 
          ? `Série créée avec ${formData.episodes.length} épisodes`
          : "Film ajouté avec succès",
      });
      setShowAddModal(false);
      resetForm();
      loadData();
      refreshData();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le contenu",
        variant: "destructive",
      });
    }
  };

  const handleEditVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    
    try {
      // Prepare video data for update
      const videoData = {
        title: formData.title,
        description: formData.description,
        thumbnail: formData.thumbnail,
        video_url: formData.type === 'movie' ? formData.videoUrl : '',
        category: formData.category,
        language: formData.language,
        year: formData.year,
        duration: formData.duration,
        type: formData.type,
        total_seasons: formData.type === 'series' ? formData.totalSeasons : null,
        total_episodes: formData.type === 'series' ? formData.episodes.length : null
      };

      // Update the video
      await apiService.updateVideo(editingVideo.id, videoData);
      
      // If it's a series, update or create episodes
      if (formData.type === 'series' && formData.episodes.length > 0) {
        for (const episode of formData.episodes) {
          if (episode.id) {
            // Update existing episode
            await apiService.updateEpisode(episode.id, {
              title: episode.title,
              description: episode.description,
              episode_number: episode.episodeNumber,
              season_number: episode.seasonNumber,
              video_url: episode.videoUrl,
              thumbnail: episode.thumbnail,
              duration: episode.duration
            });
          } else {
            // Create new episode
            const newEpisode = await apiService.createEpisode({
              series_id: editingVideo.id,
              title: episode.title,
              description: episode.description,
              episode_number: episode.episodeNumber,
              season_number: episode.seasonNumber,
              video_url: episode.videoUrl,
              thumbnail: episode.thumbnail,
              duration: episode.duration
            });

            // Send Discord webhook for new episode
            try {
              await apiService.sendDiscordWebhook({
                type: 'episode',
                title: episode.title,
                seriesTitle: editingVideo.title,
                category: editingVideo.category,
                addedBy: user?.username || 'Admin',
                videoUrl: editingVideo.id,
                thumbnail: episode.thumbnail || editingVideo.thumbnail,
                episodeNumber: episode.episodeNumber,
                seasonNumber: episode.seasonNumber
              });
            } catch (webhookError) {
              console.error('Discord webhook failed for new episode:', webhookError);
            }
          }
        }
      }

      toast({
        title: "Succès",
        description: formData.type === 'series' && formData.episodes.length > 0
          ? `Série modifiée et ${formData.episodes.length} nouveaux épisodes ajoutés`
          : "Contenu modifié avec succès",
      });
      setEditingVideo(null);
      resetForm();
      loadData();
      refreshData();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le contenu",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) return;
    
    try {
      await apiService.deleteVideo(id);
      toast({
        title: "Succès",
        description: "Vidéo supprimée avec succès",
      });
      loadData();
      refreshData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la vidéo",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (video: Video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description,
      thumbnail: video.thumbnail,
      videoUrl: video.videoUrl,
      category: video.category,
      language: video.language,
      year: video.year,
      duration: video.duration,
      createdBy: video.createdBy,
      type: (video.type || 'movie') as 'movie' | 'series',
      totalSeasons: video.totalSeasons || 1,
      episodes: video.episodes || []
    });
    
    // Load existing episodes if it's a series
    if (video.type === 'series') {
      try {
        const episodesData = await apiService.getEpisodes(video.id);
        setExistingEpisodes(episodesData);
        // Set existing episodes in form data for editing
        setFormData(prev => ({
          ...prev,
          episodes: episodesData.map(ep => ({
            id: ep.id,
            title: ep.title,
            description: ep.description,
            videoUrl: ep.video_url,
            thumbnail: ep.thumbnail,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            duration: ep.duration
          }))
        }));
      } catch (error) {
        console.error('Error loading episodes:', error);
        setExistingEpisodes([]);
      }
    } else {
      setExistingEpisodes([]);
    }
    
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    await handleDeleteVideo(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (editingVideo) {
      await handleEditVideo(e);
    } else {
      await handleAddVideo(e);
    }
  };

  // Category handlers
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description,
      color: category.color
    });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    
    try {
      await apiService.deleteCategory(id);
      toast({
        title: "Succès",
        description: "Catégorie supprimée avec succès",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la catégorie",
        variant: "destructive",
      });
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await apiService.updateCategory(editingCategory.id, categoryFormData);
        toast({
          title: "Succès",
          description: "Catégorie modifiée avec succès",
        });
      } else {
        await apiService.createCategory(categoryFormData);
        toast({
          title: "Succès",
          description: "Catégorie ajoutée avec succès",
        });
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      resetCategoryForm();
      loadData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'opération",
        variant: "destructive",
      });
    }
  };

  // User handlers
  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      email: user.email,
      role: user.role
    });
    setShowUserModal(true);
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    
    try {
      await apiService.deleteUser(id);
      toast({
        title: "Succès",
        description: "Utilisateur supprimé avec succès",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'utilisateur",
        variant: "destructive",
      });
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      await apiService.updateUser(editingUser.id, userFormData);
      toast({
        title: "Succès",
        description: "Utilisateur modifié avec succès",
      });
      setShowUserModal(false);
      setEditingUser(null);
      resetUserForm();
      loadData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'utilisateur",
        variant: "destructive",
      });
    }
  };

  // Episode management
  const addEpisode = () => {
    const newEpisode: Episode = {
      title: '',
      description: '',
      videoUrl: '',
      thumbnail: '',
      seasonNumber: 1,
      episodeNumber: formData.episodes.length + 1,
      duration: ''
    };
    setFormData({ ...formData, episodes: [...formData.episodes, newEpisode] });
  };

  const removeEpisode = async (index: number) => {
    const episode = formData.episodes[index];
    
    // If the episode has an ID, it exists in the database and needs to be deleted
    if (episode.id) {
      if (!confirm('Êtes-vous sûr de vouloir supprimer cet épisode ?')) return;
      
      try {
        await apiService.deleteEpisode(episode.id);
        toast({
          title: "Succès",
          description: "Épisode supprimé avec succès",
        });
      } catch (error) {
        console.error('Error deleting episode:', error);
        toast({
          title: "Erreur",
          description: "Impossible de supprimer l'épisode",
          variant: "destructive",
        });
        return; // Don't remove from form if API call failed
      }
    }
    
    // Remove from form data
    const newEpisodes = formData.episodes.filter((_, i) => i !== index);
    setFormData({ ...formData, episodes: newEpisodes });
  };

  const updateEpisode = (index: number, field: keyof Episode, value: any) => {
    const newEpisodes = [...formData.episodes];
    newEpisodes[index] = { ...newEpisodes[index], [field]: value };
    setFormData({ ...formData, episodes: newEpisodes });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      thumbnail: '',
      videoUrl: '',
      category: '',
      language: 'Français',
      year: new Date().getFullYear(),
      duration: '',
      createdBy: user?.id || '',
      type: 'movie',
      totalSeasons: 1,
      episodes: []
    });
    setExistingEpisodes([]);
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      color: '#e74c3c'
    });
  };

  const resetUserForm = () => {
    setUserFormData({
      username: '',
      email: '',
      role: 'user'
    });
  };

  const resetNotificationForm = () => {
    setNotificationFormData({
      title: '',
      message: '',
      sendToAll: true,
      selectedUserId: ''
    });
  };

  const resetSubscriptionForm = () => {
    setSubscriptionFormData({
      selectedUserId: '',
      planCode: 'essentiel',
      durationMonths: 1
    });
  };

  const resetSubtitleForm = () => {
    setSubtitleForm({
      language: '',
      languageName: '',
      subtitleUrl: '',
      isDefault: false
    });
  };

  // Subtitle handlers
  const handleAddSubtitle = async (video: any, episode?: any) => {
    setCurrentVideoForSubtitle(video);
    setCurrentEpisodeForSubtitle(episode || null);
    
    // Charger les sous-titres existants
    try {
      const videoId = episode?.id || video?.id;
      if (videoId) {
        const subtitles = await apiService.getSubtitles(videoId);
        setCurrentVideoSubtitles(subtitles || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des sous-titres:', error);
    }
    
    setShowSubtitleModal(true);
  };

  const handleDeleteSubtitle = async (subtitleId: string) => {
    try {
      await apiService.deleteSubtitle(subtitleId);
      
      // Recharger les sous-titres après suppression
      const videoId = currentEpisodeForSubtitle?.id || currentVideoForSubtitle?.id;
      if (videoId) {
        const subtitles = await apiService.getSubtitles(videoId);
        setCurrentVideoSubtitles(subtitles || []);
      }
      
      toast({
        title: "Succès",
        description: "Sous-titre supprimé avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le sous-titre",
        variant: "destructive",
      });
    }
  };

  const addSubtitle = async () => {
    try {
      if (!subtitleForm.language || !subtitleForm.languageName || !subtitleForm.subtitleUrl) {
        toast({
          title: "Erreur",
          description: "Veuillez remplir tous les champs requis",
          variant: "destructive",
        });
        return;
      }

      const subtitleData = {
        videoId: currentVideoForSubtitle?.id || '',
        episodeId: currentEpisodeForSubtitle?.id || null,
        language: subtitleForm.language,
        languageName: subtitleForm.languageName,
        subtitleUrl: subtitleForm.subtitleUrl,
        isDefault: subtitleForm.isDefault
      };

      await apiService.addSubtitle(subtitleData);
      
      // Recharger les sous-titres après ajout
      const videoId = currentVideoForSubtitle?.id || currentEpisodeForSubtitle?.id;
      if (videoId) {
        const subtitles = await apiService.getSubtitles(videoId);
        setCurrentVideoSubtitles(subtitles || []);
      }
      
      toast({
        title: "Succès",
        description: "Sous-titre ajouté avec succès",
        variant: "default",
      });
      resetSubtitleForm();
      
    } catch (error) {
      console.error('Erreur lors de l\'ajout du sous-titre:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le sous-titre",
        variant: "destructive",
      });
    }
  };

  const handleSubtitleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addSubtitle();
  };

  // Subscription handlers
  const handleGiveSubscription = (userId: string) => {
    setSubscriptionFormData(prev => ({ ...prev, selectedUserId: userId }));
    setShowSubscriptionModal(true);
  };

  const handleSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase.functions.invoke('give-subscription', {
        body: {
          user_id: subscriptionFormData.selectedUserId,
          plan_code: subscriptionFormData.planCode,
          duration_months: subscriptionFormData.durationMonths
        }
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Abonnement ${subscriptionFormData.planCode} offert avec succès`,
      });
      setShowSubscriptionModal(false);
      resetSubscriptionForm();
      loadData();
      
      // Force refresh subscription context for all users
      window.dispatchEvent(new CustomEvent('subscription-updated'));
    } catch (error) {
      console.error('Error giving subscription:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'offrir l'abonnement",
        variant: "destructive",
      });
    }
  };

  // Notification handlers
  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (notificationFormData.sendToAll) {
        await apiService.sendNotificationToAll(notificationFormData.title, notificationFormData.message);
      } else {
        await apiService.sendNotification(notificationFormData.selectedUserId, notificationFormData.title, notificationFormData.message);
      }
      
      toast({
        title: "Succès",
        description: notificationFormData.sendToAll 
          ? "Notification envoyée à tous les utilisateurs" 
          : "Notification envoyée à l'utilisateur sélectionné",
      });
      setShowNotificationModal(false);
      resetNotificationForm();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la notification",
        variant: "destructive",
      });
    }
  };

  // Filter videos based on search and category
  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         video.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || video.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const tabs = [
    { id: 'videos', label: 'Vidéos', icon: VideoIcon },
    { id: 'categories', label: 'Catégories', icon: Grid },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'stats', label: 'Statistiques', icon: BarChart }
  ];

  const statistics = {
    totalVideos: stats.totalVideos,
    totalUsers: stats.totalUsers,
    totalViews: stats.totalViews
  };

  // Helper function to safely format rating
  const formatRating = (rating: any) => {
    const numRating = parseFloat(rating);
    return isNaN(numRating) ? '0.0' : numRating.toFixed(1);
  };

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="container mx-auto px-4 md:px-16 py-8 pt-24">
        {/* Header with Netflix-style glassmorphism */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent rounded-2xl blur-xl"></div>
          <div className="relative bg-black/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent mb-2 flex items-center space-x-3">
              <Shield className="w-10 h-10 text-red-500" />
              <span>Panel Administrateur</span>
            </h1>
            <p className="text-gray-400 text-lg">Bienvenue, {user.username}</p>
          </div>
        </div>

        {/* Stats Cards with glassmorphism */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50 hover:border-red-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <VideoIcon className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                  <span>Vidéos</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalVideos}</div>
              <p className="text-sm text-gray-400">+{stats.recentVideos} cette semaine</p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50 hover:border-blue-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                  <span>Utilisateurs</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalUsers}</div>
              <p className="text-sm text-gray-400">+{stats.recentUsers} nouveaux</p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50 hover:border-green-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform" />
                  <span>Vues</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalViews.toLocaleString()}</div>
              <p className="text-sm text-gray-400">Total des vues</p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50 hover:border-purple-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Grid className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
                  <span>Catégories</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{categories.length}</div>
              <p className="text-sm text-gray-400">Genres disponibles</p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation with Netflix style */}
        <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-2 mb-8">
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === id
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/25 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div className="space-y-6">
            {/* Controls with glassmorphism */}
            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Gestion des Vidéos</h2>
                <Button
                  onClick={() => {
                    resetForm();
                    setShowAddModal(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all duration-300"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter une vidéo
                </Button>
              </div>
            </div>

            {/* Videos Table */}
            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-900/50">
                    <TableRow>
                      <TableHead className="text-gray-300">Miniature</TableHead>
                      <TableHead className="text-gray-300">Titre</TableHead>
                      <TableHead className="text-gray-300">Catégorie</TableHead>
                      <TableHead className="text-gray-300">Année</TableHead>
                      <TableHead className="text-gray-300">Vues</TableHead>
                      <TableHead className="text-gray-300">Note</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVideos.map((video) => (
                      <TableRow key={video.id} className="border-gray-800/50">
                        <TableCell>
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-16 h-10 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/160x90/64748b/f1f5f9?text=Video';
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-white">
                          <div className="max-w-xs">
                            <div className="truncate font-medium">{video.title}</div>
                            <div className="text-sm text-gray-400">{video.duration}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="bg-gray-800/50 text-gray-300 px-2 py-1 rounded text-sm">
                            {video.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400">{video.year}</TableCell>
                        <TableCell className="text-gray-400">{(video.views || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-yellow-400">{formatRating(video.averageRating)}</span>
                            <span className="text-gray-500 text-sm">({video.totalRatings || 0})</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(video)}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(video.id)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Gestion des Catégories</h2>
                <Button
                  onClick={() => {
                    resetCategoryForm();
                    setShowCategoryModal(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all duration-300"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter une catégorie
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <Card key={category.id} className="bg-black/40 backdrop-blur-xl border-gray-800/50 hover:border-red-500/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-white font-semibold text-lg mb-2">{category.name}</h3>
                    <p className="text-gray-400 text-sm mb-4">{category.description}</p>
                    <div className="text-gray-500 text-sm">
                      {videos.filter(v => v.category === category.name).length} vidéos
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white">Gestion des Utilisateurs</h2>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-900/50">
                    <TableRow>
                      <TableHead className="text-gray-300">Nom d'utilisateur</TableHead>
                      <TableHead className="text-gray-300">Email</TableHead>
                      <TableHead className="text-gray-300">Rôle</TableHead>
                      <TableHead className="text-gray-300">Date d'inscription</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-gray-800/50">
                        <TableCell className="text-white">{user.username}</TableCell>
                        <TableCell className="text-gray-400">{user.email}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-sm ${
                            user.role === 'admin' 
                              ? 'bg-red-600 text-white' 
                              : 'bg-gray-800/50 text-gray-300'
                          }`}>
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                         <TableCell>
                           <div className="flex space-x-2">
                             <button
                               onClick={() => {
                                 setSelectedUserForManagement(user);
                                 setShowUserManagementModal(true);
                               }}
                               className="text-purple-400 hover:text-purple-300 transition-colors"
                               title="Gestion complète"
                             >
                               <UserCog className="w-4 h-4" />
                             </button>
                             {user.username !== 'fragment5685' && user.username !== 'nazam' && (
                             <div className="flex space-x-2">
                               <button
                                 onClick={() => handleGiveSubscription(user.id)}
                                 className="text-green-400 hover:text-green-300 transition-colors"
                                 title="Offrir un abonnement"
                               >
                                 <Star className="w-4 h-4" />
                               </button>
                               <button
                                 onClick={() => handleDeleteUser(user.id)}
                                 className="text-red-400 hover:text-red-300 transition-colors"
                                 title="Supprimer"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                             )}
                           </div>
                         </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Gestion des Notifications</h2>
                <Button
                  onClick={() => setShowNotificationModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Envoyer une notification</span>
                </Button>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Actions disponibles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
                  <h4 className="text-blue-400 font-semibold mb-2">Notification à tous</h4>
                  <p className="text-gray-300 text-sm">Envoyer une notification à tous les utilisateurs du site</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4">
                  <h4 className="text-purple-400 font-semibold mb-2">Notification ciblée</h4>
                  <p className="text-gray-300 text-sm">Envoyer une notification à un utilisateur spécifique</p>
                </div>
              </div>
            </div>

            {/* Liste des utilisateurs avec leurs notifications */}
            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Utilisateurs avec notifications</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  // Grouper les notifications par utilisateur
                  const notificationsByUser = allNotifications.reduce((acc, notification) => {
                    const userId = notification.user_id;
                    const username = notification.profiles?.username || 'Utilisateur supprimé';
                    
                    if (!acc[userId]) {
                      acc[userId] = {
                        username,
                        notifications: []
                      };
                    }
                    acc[userId].notifications.push(notification);
                    return acc;
                  }, {} as Record<string, { username: string; notifications: any[] }>);

                  // Trier par nom d'utilisateur
                  const sortedUsers = Object.entries(notificationsByUser).sort(([, a], [, b]) => 
                    (a as { username: string; notifications: any[] }).username.localeCompare((b as { username: string; notifications: any[] }).username)
                  );

                  return sortedUsers.map(([userId, userData]) => {
                    const typedUserData = userData as { username: string; notifications: any[] };
                    const unreadCount = typedUserData.notifications.filter(n => !n.is_read).length;
                    
                    return (
                      <button
                        key={userId}
                        onClick={() => {
                          setSelectedUserNotifications({
                            userId,
                            username: typedUserData.username,
                            notifications: typedUserData.notifications
                          });
                          setShowUserNotificationsModal(true);
                        }}
                        className="border border-gray-700/50 rounded-xl p-4 bg-gray-900/30 hover:bg-gray-800/50 transition-colors text-left w-full"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-semibold text-lg">
                            {typedUserData.username}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 text-sm">
                              {typedUserData.notifications.length} total
                            </span>
                            {unreadCount > 0 && (
                              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm mt-2">
                          Cliquez pour voir les notifications
                        </p>
                      </button>
                    );
                  });
                })()}
                
                {allNotifications.length === 0 && (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-400">Aucune notification trouvée</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white">Statistiques</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">Total Vidéos</h3>
                      <p className="text-3xl font-bold text-red-400">{statistics.totalVideos}</p>
                    </div>
                    <Film className="w-12 h-12 text-red-400" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">Total Utilisateurs</h3>
                      <p className="text-3xl font-bold text-blue-400">{statistics.totalUsers}</p>
                    </div>
                    <Users className="w-12 h-12 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">Total Vues</h3>
                      <p className="text-3xl font-bold text-green-400">{statistics.totalViews.toLocaleString()}</p>
                    </div>
                    <Eye className="w-12 h-12 text-green-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-black/40 backdrop-blur-xl border-gray-800/50">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">Top 5 Vidéos les Plus Regardées</h3>
                <div className="space-y-3">
                  {videos
                    .sort((a, b) => (b.views || 0) - (a.views || 0))
                    .slice(0, 5)
                    .map((video, index) => (
                      <div key={video.id} className="flex items-center space-x-4 bg-gray-800/50 p-3 rounded">
                        <div className="bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-16 h-10 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/160x90/64748b/f1f5f9?text=Video';
                          }}
                        />
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{video.title}</h4>
                          <p className="text-gray-400 text-sm">{(video.views || 0).toLocaleString()} vues</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-yellow-400">{formatRating(video.averageRating)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Video Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  {editingVideo ? 'Modifier la vidéo' : 'Ajouter une vidéo'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingVideo(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Type de contenu */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type de contenu *
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="movie"
                        checked={formData.type === 'movie'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'movie' | 'series', episodes: [] })}
                        className="text-red-500"
                      />
                      <Film className="w-4 h-4 text-gray-400" />
                      <span className="text-white">Film</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="series"
                        checked={formData.type === 'series'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'movie' | 'series' })}
                        className="text-red-500"
                      />
                      <VideoIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-white">Série</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Titre *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Catégorie *
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.name}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Année *
                    </label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      required
                      min="1900"
                      max={new Date().getFullYear() + 5}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Durée *
                    </label>
                    <input
                      type="text"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      required
                      placeholder="ex: 120min"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Langue
                    </label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                    >
                      <option value="Français">Français</option>
                      <option value="English">English</option>
                      <option value="Español">Español</option>
                      <option value="Deutsch">Deutsch</option>
                      <option value="Italiano">Italiano</option>
                      <option value="日本語">日本語</option>
                      <option value="한국어">한국어</option>
                      <option value="中文">中文</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL de la miniature
                    </label>
                    <input
                      type="url"
                      value={formData.thumbnail}
                      onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                    />
                  </div>
                  
                  {/* URL de la vidéo pour les films */}
                  {formData.type === 'movie' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        URL de la vidéo *
                      </label>
                      <input
                        type="url"
                        value={formData.videoUrl}
                        onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                        className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                        required
                        placeholder="https://exemple.com/video.mp4"
                      />
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => handleAddSubtitle({ id: editingVideo?.id || 'new' })}
                          className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded flex items-center space-x-1"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Ajouter des sous-titres</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Champs pour série */}
                {formData.type === 'series' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Nombre de saisons
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.totalSeasons}
                        onChange={(e) => setFormData({ ...formData, totalSeasons: parseInt(e.target.value) })}
                        className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      />
                    </div>

                    {/* Affichage des épisodes existants */}
                    {existingEpisodes.length > 0 && (
                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
                        <h4 className="text-lg font-semibold text-blue-400 mb-3 flex items-center space-x-2">
                          <PlayCircle className="w-5 h-5" />
                          <span>Épisodes existants ({existingEpisodes.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                          {existingEpisodes.map((episode, index) => (
                            <div key={episode.id || index} className="bg-gray-800/30 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-blue-300 font-medium text-sm">
                                  S{episode.seasonNumber}E{episode.episodeNumber}
                                </span>
                                <span className="text-gray-400 text-xs">{episode.duration}</span>
                              </div>
                              <h5 className="text-white text-sm font-medium truncate">{episode.title}</h5>
                              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{episode.description}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-blue-300 text-sm mt-3">
                          Ces épisodes sont déjà enregistrés pour cette série. Vous pouvez ajouter de nouveaux épisodes ci-dessous.
                        </p>
                      </div>
                    )}

                    {/* Gestion des épisodes */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-semibold text-white flex items-center space-x-2">
                          <PlayCircle className="w-5 h-5" />
                          <span>Nouveaux épisodes ({formData.episodes.length})</span>
                        </h4>
                        <button
                          type="button"
                          onClick={addEpisode}
                          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Ajouter un épisode</span>
                        </button>
                      </div>

                      <div className="space-y-4 max-h-60 overflow-y-auto">
                        {formData.episodes.map((episode, index) => (
                          <div key={index} className="bg-gray-800/50 p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="text-white font-medium flex items-center space-x-2">
                                <span>Épisode {episode.episodeNumber}</span>
                                <span className="text-xs text-green-400 px-2 py-1 bg-green-900 rounded">
                                  Nouveau
                                </span>
                              </h5>
                              <button
                                type="button"
                                onClick={() => removeEpisode(index)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                  Saison
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max={formData.totalSeasons}
                                  value={episode.seasonNumber}
                                  onChange={(e) =>
                                    updateEpisode(index, 'seasonNumber', parseInt(e.target.value))
                                  }
                                  className="w-full bg-gray-700/50 border border-gray-600/50 text-white rounded px-2 py-1 text-sm focus:border-red-500 focus:outline-none"
                                />
                              </div>
                            
                              <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                  Durée
                                </label>
                                <input
                                  type="text"
                                  value={episode.duration}
                                  onChange={(e) =>
                                    updateEpisode(index, 'duration', e.target.value)
                                  }
                                  placeholder="ex: 45min"
                                  className="w-full bg-gray-700/50 border border-gray-600/50 text-white rounded px-2 py-1 text-sm focus:border-red-500 focus:outline-none placeholder:text-gray-500"
                                />
                              </div>
                            </div>
                            
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-400 mb-1">
                                Titre de l'épisode
                              </label>
                              <input
                                type="text"
                                value={episode.title}
                                onChange={(e) => updateEpisode(index, 'title', e.target.value)}
                                className="w-full bg-gray-700/50 border border-gray-600/50 text-white rounded px-2 py-1 text-sm focus:border-red-500 focus:outline-none"
                              />
                            </div>
                            
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-400 mb-1">
                                URL de la vidéo
                              </label>
                              <input
                                type="url"
                                value={episode.videoUrl}
                                onChange={(e) => updateEpisode(index, 'videoUrl', e.target.value)}
                                className="w-full bg-gray-700/50 border border-gray-600/50 text-white rounded px-2 py-1 text-sm focus:border-red-500 focus:outline-none"
                              />
                            </div>
                            
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-400 mb-1">
                                URL de la miniature
                              </label>
                              <input
                                type="url"
                                value={episode.thumbnail}
                                onChange={(e) => updateEpisode(index, 'thumbnail', e.target.value)}
                                className="w-full bg-gray-700/50 border border-gray-600/50 text-white rounded px-2 py-1 text-sm focus:border-red-500 focus:outline-none"
                              />
                            </div>
                            
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-400 mb-1">
                                Description
                              </label>
                              <textarea
                                value={episode.description}
                                onChange={(e) => updateEpisode(index, 'description', e.target.value)}
                                rows={2}
                                className="w-full bg-gray-700/50 border border-gray-600/50 text-white rounded px-2 py-1 text-sm focus:border-red-500 focus:outline-none"
                              />
                            </div>
                            
                            {/* Button for managing subtitles */}
                            <div className="mt-3 pt-2 border-t border-gray-600/50">
                                <button
                                  type="button"
                                  onClick={() => handleAddSubtitle({ id: editingVideo?.id || 'new' }, episode)}
                                  className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded flex items-center space-x-1"
                                >
                                <Plus className="w-3 h-3" />
                                <span>Ajouter sous-titres</span>
                              </button>
                            </div>
                            
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingVideo(null);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    Annuler
                  </button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
                    disabled={loading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingVideo ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  {editingCategory ? 'Modifier la catégorie' : 'Ajouter une catégorie'}
                </h3>
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    resetCategoryForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCategorySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Couleur
                  </label>
                  <input
                    type="color"
                    value={categoryFormData.color}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                    className="w-full h-12 bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl focus:border-red-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategoryModal(false);
                      setEditingCategory(null);
                      resetCategoryForm();
                    }}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    Annuler
                  </button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingCategory ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* User Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Modifier l'utilisateur</h3>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                    resetUserForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom d'utilisateur
                  </label>
                  <input
                    type="text"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rôle
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as 'admin' | 'user' })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserModal(false);
                      setEditingUser(null);
                      resetUserForm();
                    }}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    Annuler
                  </button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notification Modal */}
        {showNotificationModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">
                Envoyer une notification
              </h3>
              
              <form onSubmit={handleNotificationSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Titre
                  </label>
                  <input
                    type="text"
                    value={notificationFormData.title}
                    onChange={(e) => setNotificationFormData({ ...notificationFormData, title: e.target.value })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                    required
                    placeholder="Titre de la notification"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message
                  </label>
                  <textarea
                    value={notificationFormData.message}
                    onChange={(e) => setNotificationFormData({ ...notificationFormData, message: e.target.value })}
                    className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all resize-none"
                    rows={4}
                    required
                    placeholder="Contenu du message"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={notificationFormData.sendToAll}
                      onChange={(e) => setNotificationFormData({ 
                        ...notificationFormData, 
                        sendToAll: e.target.checked,
                        selectedUserId: e.target.checked ? '' : notificationFormData.selectedUserId
                      })}
                      className="rounded border-gray-700 bg-black/50 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-300">Envoyer à tous les utilisateurs</span>
                  </label>
                </div>

                {!notificationFormData.sendToAll && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Utilisateur cible
                    </label>
                    <select
                      value={notificationFormData.selectedUserId}
                      onChange={(e) => setNotificationFormData({ ...notificationFormData, selectedUserId: e.target.value })}
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      required
                    >
                      <option value="">Sélectionner un utilisateur</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotificationModal(false);
                      resetNotificationForm();
                    }}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    Annuler
                  </button>
                  <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Envoyer
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Notification Modal */}
        {showEditNotificationModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">
                Modifier la notification
              </h3>
              
              <form onSubmit={handleUpdateNotification} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Titre
                  </label>
                  <input
                    type="text"
                    value={notificationFormData.title}
                    onChange={(e) => setNotificationFormData({ ...notificationFormData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-red-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message
                  </label>
                  <textarea
                    value={notificationFormData.message}
                    onChange={(e) => setNotificationFormData({ ...notificationFormData, message: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-red-500 focus:outline-none"
                    rows={4}
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditNotificationModal(false);
                      setEditingNotification(null);
                      resetNotificationForm();
                    }}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    Annuler
                  </button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Subscription Gift Modal */}
        {showSubscriptionModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Offrir un abonnement</h3>
                <button
                  onClick={() => {
                    setShowSubscriptionModal(false);
                    resetSubscriptionForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubscriptionSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type d'abonnement
                  </label>
                  <select
                    value={subscriptionFormData.planCode}
                    onChange={(e) => setSubscriptionFormData({ 
                      ...subscriptionFormData, 
                      planCode: e.target.value as 'essentiel' | 'premium' | 'lifetime'
                    })}
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="essentiel">Essentiel</option>
                    <option value="premium">Premium</option>
                    <option value="lifetime">À vie</option>
                  </select>
                </div>

                {subscriptionFormData.planCode !== 'lifetime' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Durée (mois)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={subscriptionFormData.durationMonths}
                      onChange={(e) => setSubscriptionFormData({ 
                        ...subscriptionFormData, 
                        durationMonths: parseInt(e.target.value) || 1
                      })}
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-red-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubscriptionModal(false);
                      resetSubscriptionForm();
                    }}
                    className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    Annuler
                  </button>
                  <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Offrir
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* User Notifications Modal */}
        {showUserNotificationsModal && selectedUserNotifications && (
          <Dialog open={showUserNotificationsModal} onOpenChange={setShowUserNotificationsModal}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-black/90 backdrop-blur-xl border-gray-800/50">
              <DialogHeader>
                <DialogTitle className="text-white text-xl">
                  Notifications de {selectedUserNotifications.username}
                  <span className="text-gray-400 text-sm ml-2">
                    ({selectedUserNotifications.notifications.length} notification{selectedUserNotifications.notifications.length > 1 ? 's' : ''})
                  </span>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 mt-6">
                {selectedUserNotifications.notifications
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((notification: any) => (
                    <div key={notification.id} className="bg-black/30 border border-gray-700/30 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="text-white font-medium">{notification.title}</h5>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              notification.is_read 
                                ? 'bg-green-900/30 text-green-400 border border-green-700/50'
                                : 'bg-red-900/30 text-red-400 border border-red-700/50'
                            }`}>
                              {notification.is_read ? 'Lue' : 'Non lue'}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mb-2">{notification.message}</p>
                          <p className="text-gray-500 text-xs">
                            {formatNotificationDate(notification.created_at)}
                          </p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => {
                              setShowUserNotificationsModal(false);
                              handleEditNotification(notification);
                            }}
                            className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              await handleDeleteNotification(notification.id);
                              // Refresh the selected user notifications
                              const updatedNotifications = selectedUserNotifications.notifications.filter(
                                (n: any) => n.id !== notification.id
                              );
                              if (updatedNotifications.length === 0) {
                                setShowUserNotificationsModal(false);
                              } else {
                                setSelectedUserNotifications({
                                  ...selectedUserNotifications,
                                  notifications: updatedNotifications
                                });
                              }
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Subtitle Modal */}
        {showSubtitleModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  Gérer les sous-titres
                  {currentVideoForSubtitle && (
                    <span className="text-sm text-gray-400 ml-2">
                      - {currentEpisodeForSubtitle ? `Episode ${currentEpisodeForSubtitle.episodeNumber}` : currentVideoForSubtitle.title || 'Vidéo'}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setShowSubtitleModal(false);
                    setCurrentVideoForSubtitle(null);
                    setCurrentEpisodeForSubtitle(null);
                    setCurrentVideoSubtitles([]);
                    resetSubtitleForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Liste des sous-titres existants */}
              {currentVideoSubtitles.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3">Sous-titres existants</h4>
                  <div className="space-y-2">
                    {currentVideoSubtitles.map((subtitle, index) => (
                      <div key={subtitle.id || index} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                              {subtitle.language}
                            </span>
                            <span className="text-white text-sm">{subtitle.language_name}</span>
                            {subtitle.is_default && (
                              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Défaut</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs mt-1 truncate">{subtitle.subtitle_url}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteSubtitle(subtitle.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Supprimer ce sous-titre"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulaire d'ajout */}
              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-lg font-semibold text-white mb-4">Ajouter un nouveau sous-titre</h4>
                
                <form onSubmit={handleSubtitleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Langue (Code)
                    </label>
                    <input
                      type="text"
                      value={subtitleForm.language}
                      onChange={(e) => setSubtitleForm({ ...subtitleForm, language: e.target.value })}
                      placeholder="fr, en, es..."
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nom de la langue
                    </label>
                    <input
                      type="text"
                      value={subtitleForm.languageName}
                      onChange={(e) => setSubtitleForm({ ...subtitleForm, languageName: e.target.value })}
                      placeholder="Français, English, Español..."
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL du fichier SRT
                    </label>
                    <input
                      type="url"
                      value={subtitleForm.subtitleUrl}
                      onChange={(e) => setSubtitleForm({ ...subtitleForm, subtitleUrl: e.target.value })}
                      placeholder="https://exemple.com/subtitles.srt"
                      className="w-full bg-black/50 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={subtitleForm.isDefault}
                        onChange={(e) => setSubtitleForm({ ...subtitleForm, isDefault: e.target.checked })}
                        className="rounded border-gray-700 bg-black/50 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-gray-300">Sous-titre par défaut</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSubtitleModal(false);
                        setCurrentVideoForSubtitle(null);
                        setCurrentEpisodeForSubtitle(null);
                        setCurrentVideoSubtitles([]);
                        resetSubtitleForm();
                      }}
                      className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors"
                    >
                      Fermer
                    </button>
                    <Button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* User Management Modal */}
        <UserManagementModal
          user={selectedUserForManagement}
          isOpen={showUserManagementModal}
          onClose={() => {
            setShowUserManagementModal(false);
            setSelectedUserForManagement(null);
          }}
          onRefresh={loadData}
        />
      </div>
    </div>
  );
};

export default AdminPanel;
