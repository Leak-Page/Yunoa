import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { apiService } from '../services/ApiService';
import { useToast } from '../hooks/use-toast';
import { 
  Shield, 
  ShieldOff, 
  Ban, 
  Clock, 
  Calendar, 
  User, 
  Mail, 
  Crown, 
  Gift,
  CreditCard,
  Play,
  Pause,
  Eye,
  EyeOff,
  Edit3,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface UserManagementModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  user,
  isOpen,
  onClose,
  onRefresh
}) => {
  const { toast } = useToast();
  
  // États pour les différentes actions
  const [activeTab, setActiveTab] = useState('overview');
  const [banData, setBanData] = useState({
    reason: '',
    duration: '1week'
  });
  const [suspensionReason, setSuspensionReason] = useState('');
  const [editData, setEditData] = useState({
    username: user?.username || '',
    role: user?.role || 'membre'
  });
  const [subscriptionData, setSubscriptionData] = useState({
    planCode: 'essentiel',
    durationMonths: 1
  });

  // États pour les informations chargées
  const [banStatus, setBanStatus] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [giftLoading, setGiftLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadUserData();
    }
  }, [isOpen, user]);

  const loadUserData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Charger le statut de ban
      const banInfo = await apiService.getUserBanStatus(user.id);
      setBanStatus(banInfo);

      // Charger l'abonnement
      const subInfo = await apiService.getUserSubscription(user.id);
      setSubscription(subInfo);

      // Mettre à jour les données d'édition
      setEditData({
        username: user.username || '',
        role: user.role || 'membre'
      });
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async () => {
    if (!banData.reason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez spécifier une raison pour le ban",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiService.banUser(user.id, banData.reason, banData.duration);
      toast({
        title: "Utilisateur banni",
        description: `${user.username} a été banni avec succès`
      });
      setBanData({ reason: '', duration: '1week' });
      loadUserData();
      onRefresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de bannir l'utilisateur",
        variant: "destructive"
      });
    }
  };

  const handleUnbanUser = async () => {
    try {
      await apiService.unbanUser(user.id);
      toast({
        title: "Utilisateur débanni",
        description: `${user.username} a été débanni avec succès`
      });
      loadUserData();
      onRefresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de débannir l'utilisateur",
        variant: "destructive"
      });
    }
  };

  const handleSuspendSubscription = async () => {
    if (!suspensionReason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez spécifier une raison pour la suspension",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiService.suspendUserSubscription(user.id, suspensionReason);
      toast({
        title: "Abonnement suspendu",
        description: "L'abonnement a été suspendu avec succès"
      });
      setSuspensionReason('');
      loadUserData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de suspendre l'abonnement",
        variant: "destructive"
      });
    }
  };

  const handleResumeSubscription = async () => {
    try {
      await apiService.resumeUserSubscription(user.id);
      toast({
        title: "Abonnement repris",
        description: "L'abonnement a été repris avec succès"
      });
      loadUserData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de reprendre l'abonnement",
        variant: "destructive"
      });
    }
  };

  const handleUpdateUser = async () => {
    try {
      await apiService.updateUser(user.id, editData);
      toast({
        title: "Utilisateur mis à jour",
        description: "Les informations ont été mises à jour avec succès"
      });
      onRefresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'utilisateur",
        variant: "destructive"
      });
    }
  };

  const handleGiveSubscription = async () => {
    setGiftLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase.functions.invoke('give-subscription', {
        body: {
          user_id: user.id,
          plan_code: subscriptionData.planCode,
          duration_months: subscriptionData.durationMonths
        }
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Abonnement ${subscriptionData.planCode} offert avec succès`
      });
      
      loadUserData();
      onRefresh();
      
      // Force refresh subscription context
      window.dispatchEvent(new CustomEvent('subscription-updated'));
    } catch (error) {
      console.error('Error giving subscription:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'offrir l'abonnement",
        variant: "destructive"
      });
    } finally {
      setGiftLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDurationLabel = (duration: string) => {
    const labels = {
      '1week': '1 semaine',
      '1month': '1 mois',
      '1year': '1 an',
      'permanent': 'Permanent'
    };
    return labels[duration as keyof typeof labels] || duration;
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="w-6 h-6" />
            Gestion de {user.username}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Navigation des onglets */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: Eye },
              { id: 'ban', label: 'Sanctions', icon: Shield },
              { id: 'subscription', label: 'Abonnement', icon: CreditCard },
              { id: 'edit', label: 'Modifier', icon: Edit3 }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {/* Contenu des onglets */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informations utilisateur */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Informations générales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-muted-foreground" />
                    <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Inscrit le {formatDate(user.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Statut de ban */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Statut de sanction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Chargement...</div>
                  ) : banStatus?.is_banned ? (
                    <div className="space-y-2">
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <Ban className="w-3 h-3" />
                        BANNI
                      </Badge>
                      <div className="text-sm space-y-1">
                        <p><strong>Raison:</strong> {banStatus.ban_reason}</p>
                        <p><strong>Banni par:</strong> {banStatus.banned_by_username}</p>
                        <p><strong>Date:</strong> {formatDate(banStatus.banned_at)}</p>
                        {!banStatus.is_permanent && banStatus.unban_at && (
                          <p><strong>Fin:</strong> {formatDate(banStatus.unban_at)}</p>
                        )}
                        {banStatus.is_permanent && (
                          <Badge variant="destructive">PERMANENT</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Utilisateur en règle</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Abonnement */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Abonnement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscription ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={subscription.subscribed ? 'default' : 'secondary'}>
                          {subscription.subscribed ? 'ACTIF' : 'INACTIF'}
                        </Badge>
                        {subscription.subscription_tier && (
                          <Badge variant="outline">{subscription.subscription_tier}</Badge>
                        )}
                      </div>
                      {subscription.subscription_end && (
                        <p className="text-sm">
                          <strong>Expire le:</strong> {formatDate(subscription.subscription_end)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Aucun abonnement trouvé
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'ban' && (
            <div className="space-y-6">
              {banStatus?.is_banned ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" />
                      Utilisateur actuellement banni
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p><strong>Raison:</strong> {banStatus.ban_reason}</p>
                      <p><strong>Banni par:</strong> {banStatus.banned_by_username}</p>
                      <p><strong>Date du ban:</strong> {formatDate(banStatus.banned_at)}</p>
                      {!banStatus.is_permanent && banStatus.unban_at && (
                        <p><strong>Fin du ban:</strong> {formatDate(banStatus.unban_at)}</p>
                      )}
                    </div>
                    <Button 
                      onClick={handleUnbanUser}
                      className="flex items-center gap-2"
                      variant="destructive"
                    >
                      <ShieldOff className="w-4 h-4" />
                      Débannir l'utilisateur
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ban className="w-5 h-5" />
                      Bannir l'utilisateur
                    </CardTitle>
                    <CardDescription>
                      Sanctionnez l'utilisateur pour violation des règles
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="ban-reason">Raison du ban *</Label>
                      <Textarea
                        id="ban-reason"
                        value={banData.reason}
                        onChange={(e) => setBanData(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Décrivez la raison du ban..."
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="ban-duration">Durée du ban</Label>
                      <Select 
                        value={banData.duration} 
                        onValueChange={(value) => setBanData(prev => ({ ...prev, duration: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1week">1 semaine</SelectItem>
                          <SelectItem value="1month">1 mois</SelectItem>
                          <SelectItem value="1year">1 an</SelectItem>
                          <SelectItem value="permanent">Permanent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-orange-800 dark:text-orange-200">
                            Attention
                          </p>
                          <p className="text-orange-700 dark:text-orange-300">
                            Cette action bannira l'utilisateur pour {getDurationLabel(banData.duration)} 
                            {banData.duration !== 'permanent' && ' et mettra son abonnement en pause'}. 
                            L'utilisateur ne pourra plus accéder au service.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleBanUser}
                      variant="destructive"
                      className="flex items-center gap-2"
                      disabled={!banData.reason.trim()}
                    >
                      <Ban className="w-4 h-4" />
                      Bannir pour {getDurationLabel(banData.duration)}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-6">
              {subscription ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Gestion de l'abonnement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Statut</Label>
                        <div className="mt-1">
                          <Badge variant={subscription.subscribed ? 'default' : 'secondary'}>
                            {subscription.subscribed ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div>
                        <Label>Plan</Label>
                        <div className="mt-1">
                          <Badge variant="outline">
                            {subscription.subscription_tier || 'Non défini'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Date d'expiration</Label>
                        <p className="text-sm mt-1">
                          {subscription.subscription_end ? formatDate(subscription.subscription_end) : 'Non définie'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="suspension-reason">Raison de la suspension</Label>
                        <Textarea
                          id="suspension-reason"
                          value={suspensionReason}
                          onChange={(e) => setSuspensionReason(e.target.value)}
                          placeholder="Pourquoi suspendre l'abonnement..."
                          className="mt-1"
                        />
                      </div>

                      <div className="flex gap-3">
                        <Button 
                          onClick={handleSuspendSubscription}
                          variant="outline"
                          className="flex items-center gap-2"
                          disabled={!suspensionReason.trim()}
                        >
                          <Pause className="w-4 h-4" />
                          Suspendre
                        </Button>
                        
                        <Button 
                          onClick={handleResumeSubscription}
                          className="flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Reprendre
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      Offrir un abonnement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="plan-code">Plan d'abonnement</Label>
                      <Select 
                        value={subscriptionData.planCode} 
                        onValueChange={(value) => setSubscriptionData(prev => ({ ...prev, planCode: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="essentiel">Essentiel</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="lifetime">Lifetime</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="duration-months">Durée (mois)</Label>
                      <Input
                        id="duration-months"
                        type="number"
                        min="1"
                        value={subscriptionData.durationMonths}
                        onChange={(e) => setSubscriptionData(prev => ({ ...prev, durationMonths: parseInt(e.target.value) || 1 }))}
                        disabled={subscriptionData.planCode === 'lifetime'}
                      />
                      {subscriptionData.planCode === 'lifetime' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Le plan Lifetime est à vie, la durée n'est pas applicable
                        </p>
                      )}
                    </div>

                    <Button 
                      onClick={handleGiveSubscription}
                      className="flex items-center gap-2"
                      disabled={giftLoading}
                    >
                      <Gift className="w-4 h-4" />
                      {giftLoading ? 'En cours...' : 'Offrir l\'abonnement'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'edit' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5" />
                  Modifier l'utilisateur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="edit-username">Nom d'utilisateur</Label>
                  <Input
                    id="edit-username"
                    value={editData.username}
                    onChange={(e) => setEditData(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-role">Rôle</Label>
                  <Select 
                    value={editData.role} 
                    onValueChange={(value) => setEditData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="membre">Membre</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleUpdateUser}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mettre à jour
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};