
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, User, Bell, Shield, Monitor, Trash2, Save, Volume2, Subtitles, Palette, Globe } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { supabaseService } from '../services/SupabaseService';
import SubscriptionStatus from './SubscriptionStatus';

const UserSettings = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    notifications: true,
    autoplay: true,
    quality: 'auto',
    language: 'fr',
    subtitles: true,
    maturity: 'all',
    volume: 0.8,
    theme: 'dark'
  });

  useEffect(() => {
    // Load user settings from localStorage
    if (user) {
      const savedSettings = localStorage.getItem(`settings_${user.id}`);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
        
        // Apply loaded settings
        Object.entries(parsedSettings).forEach(([key, value]) => {
          applySettings(key, value);
        });
      }
    }
  }, [user]);

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = {
      ...settings,
      [key]: value
    };
    setSettings(newSettings);
    
    // Auto-save settings immediately
    if (user) {
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(newSettings));
      
      // Apply settings in real time
      applySettings(key, value);
    }
  };

  const applySettings = (key: string, value: any) => {
    switch (key) {
      case 'volume':
        // Apply volume to all video elements
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          video.volume = value;
        });
        break;
      case 'autoplay':
        // Store autoplay preference
        localStorage.setItem('autoplay_preference', value.toString());
        break;
      case 'quality':
        // Store quality preference
        localStorage.setItem('video_quality', value);
        break;
      case 'language':
        // Apply language change to interface
        document.documentElement.lang = value;
        break;
    }
  };

  const saveSettings = () => {
    if (user) {
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(settings));
      toast({
        title: "Paramètres sauvegardés",
        description: "Vos préférences ont été enregistrées avec succès.",
      });
    }
  };

  const clearData = async () => {
    if (user && confirm('Êtes-vous sûr de vouloir effacer toutes vos données ? Cette action est irréversible.')) {
      try {
        // Clear watch history from Supabase
        await supabaseService.supabase
          .from('watch_history')
          .delete()
          .eq('user_id', user.id);
        
        // Clear favorites from Supabase
        await supabaseService.supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id);
        
        // Clear ratings from Supabase
        await supabaseService.supabase
          .from('ratings')
          .delete()
          .eq('user_id', user.id);
        
        // Clear localStorage data as fallback
        localStorage.removeItem(`favorites_${user.id}`);
        localStorage.removeItem(`history_${user.id}`);
        localStorage.removeItem(`ratings_${user.id}`);
        localStorage.removeItem(`settings_${user.id}`);
        
        toast({
          title: "Données effacées",
          description: "Toutes vos données personnelles ont été supprimées.",
        });
      } catch (error) {
        console.error('Error clearing data:', error);
        toast({
          title: "Erreur",
          description: "Impossible d'effacer toutes les données. Certaines données locales ont été supprimées.",
          variant: "destructive"
        });
      }
    }
  };

  const exportData = async () => {
    if (!user) return;
    
    try {
      // Export from Supabase instead of localStorage
      const [watchHistory, favorites] = await Promise.all([
        supabaseService.getWatchHistory(user.id),
        supabaseService.getFavorites(user.id)
      ]);
      
      const userData = {
        favorites: favorites,
        history: watchHistory,
        ratings: JSON.parse(localStorage.getItem(`ratings_${user.id}`) || '{}'),
        settings: JSON.parse(localStorage.getItem(`settings_${user.id}`) || '{}'),
      };
      
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `yunoa-data-${user.username}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Données exportées",
        description: "Vos données ont été téléchargées avec succès.",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données.",
        variant: "destructive"
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black pt-20 flex items-center justify-center">
        <div className="text-center">
          <Settings className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl text-white font-bold mb-4">Accès refusé</h1>
          <p className="text-gray-400">Vous devez être connecté pour accéder aux paramètres</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 px-4 md:px-16">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl text-white font-bold mb-8 flex items-center space-x-3">
          <Settings className="w-10 h-10 text-red-500" />
          <span>Paramètres</span>
        </h1>

        <div className="grid gap-8">
          {/* Abonnement */}
          <SubscriptionStatus />
          
          {/* Profil */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800">
            <h2 className="text-2xl text-white font-semibold mb-6 flex items-center space-x-2">
              <User className="w-6 h-6 text-red-500" />
              <span>Profil utilisateur</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 mb-2 font-medium">Nom d'utilisateur</label>
                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-xl px-4 py-3 opacity-50 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2 font-medium">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-xl px-4 py-3 opacity-50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800">
            <h2 className="text-2xl text-white font-semibold mb-6 flex items-center space-x-2">
              <Bell className="w-6 h-6 text-blue-500" />
              <span>Notifications</span>
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl">
                <div>
                  <span className="text-white font-medium">Notifications push</span>
                  <p className="text-gray-400 text-sm">Recevoir des notifications pour les nouveautés</p>
                </div>
                <button
                  onClick={() => handleSettingChange('notifications', !settings.notifications)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    settings.notifications ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      settings.notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Lecture */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800">
            <h2 className="text-2xl text-white font-semibold mb-6 flex items-center space-x-2">
              <Monitor className="w-6 h-6 text-green-500" />
              <span>Lecture vidéo</span>
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl">
                <div>
                  <span className="text-white font-medium">Lecture automatique</span>
                  <p className="text-gray-400 text-sm">Lancer automatiquement la vidéo suivante</p>
                </div>
                <button
                  onClick={() => handleSettingChange('autoplay', !settings.autoplay)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    settings.autoplay ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      settings.autoplay ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 bg-gray-800/30 rounded-xl">
                <label className="block text-white font-medium mb-3">Qualité vidéo par défaut</label>
                <select
                  value={settings.quality}
                  onChange={(e) => handleSettingChange('quality', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="auto">Automatique (recommandé)</option>
                  <option value="low">Faible (480p)</option>
                  <option value="medium">Moyenne (720p)</option>
                  <option value="high">Élevée (1080p)</option>
                  <option value="ultra">Ultra (4K)</option>
                </select>
              </div>

              <div className="p-4 bg-gray-800/30 rounded-xl">
                <label className="block text-white font-medium mb-3 flex items-center space-x-2">
                  <Volume2 className="w-5 h-5" />
                  <span>Volume par défaut</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.volume}
                  onChange={(e) => handleSettingChange('volume', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-gray-400 mt-1">
                  <span>0%</span>
                  <span>{Math.round(settings.volume * 100)}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl">
                <div className="flex items-center space-x-2">
                  <Subtitles className="w-5 h-5 text-white" />
                  <div>
                    <span className="text-white font-medium">Sous-titres par défaut</span>
                    <p className="text-gray-400 text-sm">Activer automatiquement les sous-titres</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSettingChange('subtitles', !settings.subtitles)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    settings.subtitles ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      settings.subtitles ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Langue et région */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800">
            <h2 className="text-2xl text-white font-semibold mb-6 flex items-center space-x-2">
              <Globe className="w-6 h-6 text-purple-500" />
              <span>Langue et région</span>
            </h2>
            
            <div className="p-4 bg-gray-800/30 rounded-xl">
              <label className="block text-white font-medium mb-3">Langue de l'interface</label>
              <select
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
              </select>
            </div>
          </div>

          {/* Contrôle parental */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800">
            <h2 className="text-2xl text-white font-semibold mb-6 flex items-center space-x-2">
              <Shield className="w-6 h-6 text-yellow-500" />
              <span>Contrôle parental</span>
            </h2>
            
            <div className="p-4 bg-gray-800/30 rounded-xl">
              <label className="block text-white font-medium mb-3">Niveau de maturité du contenu</label>
              <select
                value={settings.maturity}
                onChange={(e) => handleSettingChange('maturity', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Tout public</option>
                <option value="teen">Adolescent et plus (13+)</option>
                <option value="mature">Adulte uniquement (18+)</option>
              </select>
              <p className="text-gray-400 text-sm mt-2">
                Contrôlez quel type de contenu peut être visionné sur ce profil
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800">
            <h2 className="text-2xl text-white font-semibold mb-6">Gestion des données</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={saveSettings}
                className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                <Save className="w-5 h-5" />
                <span>Sauvegarder</span>
              </button>
              
              <button
                onClick={exportData}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                <Monitor className="w-5 h-5" />
                <span>Exporter</span>
              </button>
              
              <button
                onClick={clearData}
                className="flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                <Trash2 className="w-5 h-5" />
                <span>Effacer</span>
              </button>
              
              <button
                onClick={logout}
                className="flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                <User className="w-5 h-5" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
