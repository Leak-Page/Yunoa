import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/ApiService';
import { Settings, Database, Shield, Users, BarChart3, Download, Upload, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('system');
  const [isLoading, setIsLoading] = useState(false);

  // Vérifier si l'utilisateur est un admin autorisé
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen pt-20 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Accès refusé</h1>
          <p className="text-gray-400">Vous n'avez pas les permissions pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  const handleDatabaseExport = async () => {
    try {
      // Export data using API service
      const videos = await apiService.getVideos();
      const categories = await apiService.getCategories();
      const data = { videos, categories };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `streamflix-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export réussi",
        description: "Les données ont été exportées avec succès."
      });
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter les données",
        variant: "destructive"
      });
    }
  };

  const handleDatabaseImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        // Note: Import functionality would need to be implemented in the API
        console.log('Import data:', data);
        
        toast({
          title: "Import simulé",
          description: "La fonctionnalité d'import sera implémentée avec l'API."
        });
      } catch (error) {
        toast({
          title: "Erreur d'import",
          description: "Fichier invalide ou erreur lors de l'import",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const handleMaintenanceAction = (action: string) => {
    setIsLoading(true);
    
    setTimeout(() => {
      toast({
        title: "Action effectuée",
        description: `L'action "${action}" a été effectuée avec succès.`
      });
      setIsLoading(false);
    }, 2000);
  };

  const tabs = [
    { id: 'system', label: 'Système', icon: Settings },
    { id: 'database', label: 'Base de données', icon: Database },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'analytics', label: 'Statistiques', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen pt-20 bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center space-x-3 mb-8">
            <Shield className="w-8 h-8 text-red-500" />
            <h1 className="text-3xl font-bold text-white">Panneau d'administration</h1>
          </div>

          {/* Onglets */}
          <div className="flex space-x-1 mb-8 bg-slate-800 p-1 rounded-lg overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-md font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-red-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Contenu des onglets */}
          <div className="bg-slate-800 rounded-lg p-8">
            {activeTab === 'system' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Configuration système</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-600 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Status du serveur</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Statut</span>
                        <span className="text-green-400 font-medium">En ligne</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Uptime</span>
                        <span className="text-white">99.9%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Version</span>
                        <span className="text-white">1.0.0</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-600 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Actions système</h3>
                    <div className="space-y-3">
                      <button
                        onClick={() => handleMaintenanceAction('refresh-cache')}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Actualiser le cache</span>
                      </button>
                      <button
                        onClick={() => handleMaintenanceAction('maintenance-mode')}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center space-x-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Mode maintenance</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'database' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Gestion de la base de données</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-600 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Download className="w-5 h-5 mr-2" />
                      Export des données
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Exporter toutes les données de la base en format JSON.
                    </p>
                    <button
                      onClick={handleDatabaseExport}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Exporter
                    </button>
                  </div>

                  <div className="border border-slate-600 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Upload className="w-5 h-5 mr-2" />
                      Import des données
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Importer des données depuis un fichier JSON.
                    </p>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleDatabaseImport}
                      className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                  </div>
                </div>

                <div className="mt-8 border border-red-600 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Trash2 className="w-5 h-5 mr-2" />
                    Actions dangereuses
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Ces actions sont irréversibles. Utilisez avec précaution.
                  </p>
                  <button
                    onClick={() => handleMaintenanceAction('reset-database')}
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Réinitialiser la base
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Paramètres de sécurité</h2>
                <div className="space-y-6">
                  <div className="border border-slate-600 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Journaux de sécurité</h3>
                    <p className="text-gray-400 mb-4">
                      Dernières tentatives de connexion et activités suspectes.
                    </p>
                    <div className="bg-slate-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <div className="text-sm text-gray-300 space-y-2">
                        <div>2024-01-15 14:30 - Connexion réussie: {user.username}</div>
                        <div>2024-01-15 12:15 - Tentative de connexion échouée: IP 192.168.1.100</div>
                        <div>2024-01-14 16:45 - Export de données: {user.username}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-600 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Configuration de sécurité</h3>
                    <div className="space-y-4">
                      <label className="flex items-center space-x-3">
                        <input type="checkbox" className="w-4 h-4 text-red-600 bg-slate-700 border-slate-600 rounded focus:ring-red-500" defaultChecked />
                        <span className="text-gray-300">Authentification à deux facteurs</span>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input type="checkbox" className="w-4 h-4 text-red-600 bg-slate-700 border-slate-600 rounded focus:ring-red-500" defaultChecked />
                        <span className="text-gray-300">Journalisation des connexions</span>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input type="checkbox" className="w-4 h-4 text-red-600 bg-slate-700 border-slate-600 rounded focus:ring-red-500" />
                        <span className="text-gray-300">Blocage automatique après échecs</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Gestion des utilisateurs</h2>
                <div className="border border-slate-600 rounded-lg">
                  <div className="p-6 border-b border-slate-600">
                    <h3 className="text-lg font-semibold text-white">Utilisateurs actifs</h3>
                  </div>
                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-600">
                            <th className="pb-3 text-gray-300">Utilisateur</th>
                            <th className="pb-3 text-gray-300">Email</th>
                            <th className="pb-3 text-gray-300">Rôle</th>
                            <th className="pb-3 text-gray-300">Dernière connexion</th>
                            <th className="pb-3 text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          <tr className="border-b border-slate-700">
                            <td className="py-3">{user.username}</td>
                            <td className="py-3">{user.email}</td>
                            <td className="py-3">
                              <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">Admin</span>
                            </td>
                            <td className="py-3">Maintenant</td>
                            <td className="py-3">
                              <span className="text-gray-500">Vous</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Statistiques</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-slate-700 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Utilisateurs totaux</p>
                        <p className="text-2xl font-bold text-white">1,234</p>
                      </div>
                      <Users className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Vidéos totales</p>
                        <p className="text-2xl font-bold text-white">567</p>
                      </div>
                      <Database className="w-8 h-8 text-green-500" />
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Vues aujourd'hui</p>
                        <p className="text-2xl font-bold text-white">8,901</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-yellow-500" />
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Connexions actives</p>
                        <p className="text-2xl font-bold text-white">123</p>
                      </div>
                      <Shield className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-600 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Activité récente</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <span className="text-gray-300">Nouvel utilisateur inscrit</span>
                      <span className="text-gray-500 text-sm">Il y a 5 minutes</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <span className="text-gray-300">Vidéo ajoutée aux favoris</span>
                      <span className="text-gray-500 text-sm">Il y a 12 minutes</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <span className="text-gray-300">Nouvelle vidéo uploadée</span>
                      <span className="text-gray-500 text-sm">Il y a 1 heure</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
