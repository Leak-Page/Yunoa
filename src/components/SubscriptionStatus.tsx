import { useState, useEffect } from 'react';
import { Crown, CreditCard, Calendar, Settings, AlertTriangle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  formatFrenchDate, 
  getDaysUntilExpiry as getDaysUntilExpiryUtil, 
  isExpired as isExpiredUtil, 
  isExpiringSoon as isExpiringSoonUtil 
} from '@/utils/dateUtils';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
  auto_renew?: boolean;
  payment_method?: string;
}

interface BillingSettings {
  preferred_method: string;
  card_auto_renew: boolean;
  paypal_auto_renew: boolean;
  paysafecard_auto_renew: boolean;
  notify_before_days: number;
}

const SubscriptionStatus = () => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadSubscriptionData();
    }
  }, [user]);

  const loadSubscriptionData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Charger le statut d'abonnement
      const { data: subData, error: subError } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      // Charger les paramètres de facturation
      const { data: billingData, error: billingError } = await supabase
        .from('billing_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (billingError && billingError.code !== 'PGRST116') {
        throw billingError;
      }

      setSubscription(subData || { subscribed: false });
      setBillingSettings(billingData);

    } catch (error) {
      console.error('Erreur lors du chargement des données d\'abonnement:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les informations d'abonnement",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBillingSettings = async (newSettings: Partial<BillingSettings>) => {
    if (!user || !billingSettings) return;

    try {
      setUpdating(true);
      
      const updatedSettings = { ...billingSettings, ...newSettings };
      
      const { error } = await supabase
        .from('billing_settings')
        .upsert({
          user_id: user.id,
          ...updatedSettings
        });

      if (error) throw error;

      setBillingSettings(updatedSettings);
      
      toast({
        title: "Paramètres mis à jour",
        description: "Vos préférences de facturation ont été sauvegardées",
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les paramètres",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const refreshSubscription = async () => {
    setLoading(true);
    await loadSubscriptionData();
  };

  const getSubscriptionEndDate = () => {
    if (!subscription?.subscription_end) return null;
    return formatFrenchDate(subscription.subscription_end, 'dd MMMM yyyy');
  };

  const getDaysUntilExpiry = () => {
    if (!subscription?.subscription_end) return null;
    return getDaysUntilExpiryUtil(subscription.subscription_end);
  };

  const isExpiringSoon = () => {
    const days = getDaysUntilExpiry();
    return days !== null && isExpiringSoonUtil(subscription.subscription_end!, billingSettings?.notify_before_days || 2);
  };

  const isExpired = () => {
    if (!subscription?.subscription_end) return false;
    return isExpiredUtil(subscription.subscription_end);
  };

  if (loading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-8">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-700 h-12 w-12"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status principal */}
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white flex items-center">
            <Crown className="w-8 h-8 text-yellow-500 mr-3" />
            Statut de l'abonnement
          </h3>
          <button
            onClick={refreshSubscription}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {subscription?.subscribed ? (
          <div className="space-y-6">
            {/* Informations de l'abonnement actif */}
            <div className={`p-6 rounded-xl border-l-4 ${
              isExpired() 
                ? 'bg-red-900/20 border-red-500' 
                : isExpiringSoon() 
                ? 'bg-yellow-900/20 border-yellow-500'
                : 'bg-green-900/20 border-green-500'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center mb-2">
                    {isExpired() ? (
                      <X className="w-6 h-6 text-red-400 mr-2" />
                    ) : isExpiringSoon() ? (
                      <AlertTriangle className="w-6 h-6 text-yellow-400 mr-2" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-400 mr-2" />
                    )}
                    <h4 className="text-xl font-semibold text-white">
                      {subscription.subscription_tier || 'Abonnement actif'}
                    </h4>
                  </div>
                  
                  {getSubscriptionEndDate() && (
                    <p className="text-gray-300 mb-2">
                      Expire le {getSubscriptionEndDate()}
                    </p>
                  )}

                  {getDaysUntilExpiry() !== null && (
                    <p className={`text-sm ${
                      isExpired() 
                        ? 'text-red-400' 
                        : isExpiringSoon() 
                        ? 'text-yellow-400' 
                        : 'text-gray-400'
                    }`}>
                      {isExpired() 
                        ? `Expiré depuis ${Math.abs(getDaysUntilExpiry()!)} jour(s)`
                        : `Expire dans ${getDaysUntilExpiry()} jour(s)`
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Alerte d'expiration */}
            {(isExpiringSoon() || isExpired()) && (
              <div className={`p-6 rounded-xl ${
                isExpired() ? 'bg-red-900/30 border border-red-500/50' : 'bg-yellow-900/30 border border-yellow-500/50'
              }`}>
                <div className="flex items-start space-x-3">
                  <AlertTriangle className={`w-6 h-6 flex-shrink-0 mt-1 ${
                    isExpired() ? 'text-red-400' : 'text-yellow-400'
                  }`} />
                  <div>
                    <h4 className={`font-semibold mb-2 ${
                      isExpired() ? 'text-red-300' : 'text-yellow-300'
                    }`}>
                      {isExpired() ? 'Abonnement expiré' : 'Expiration proche'}
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed mb-4">
                      {isExpired() 
                        ? 'Votre abonnement a expiré. Renouvelez-le pour continuer à profiter de nos contenus.'
                        : 'Votre abonnement expire bientôt. Assurez-vous que vos informations de paiement sont à jour.'
                      }
                    </p>
                    <button 
                      onClick={() => navigate('/subscription')}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Renouveler maintenant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Crown className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-white mb-2">Aucun abonnement actif</h4>
            <p className="text-gray-400 mb-6">Souscrivez à un plan pour accéder à tous nos contenus premium</p>
            <button 
              onClick={() => navigate('/subscription')}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl font-semibold transition-all"
            >
              Voir les plans
            </button>
          </div>
        )}
      </div>

            {/* Paramètres de facturation */}
      {subscription?.subscribed && (
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
            <Settings className="w-8 h-8 text-blue-500 mr-3" />
            Paramètres de facturation
          </h3>

          <div className="space-y-6">
            {/* Informations de paiement actuelles */}
            <div className="bg-gray-800/30 rounded-xl p-6">
              <h4 className="text-white font-medium mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Méthode de paiement actuelle
              </h4>
              <div className="flex items-center justify-between">
                <div className="text-gray-300">
                  <p className="text-sm">Carte se terminant par ••••</p>
                  <p className="text-xs text-gray-400">Expire 12/25</p>
                </div>
                <button
                  onClick={() => window.open('https://billing.stripe.com/p/login/test_00000000000000000000000000', '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Gérer
                </button>
              </div>
            </div>

            {/* Méthode de paiement préférée */}
            {billingSettings && (
              <div>
                <label className="block text-white font-medium mb-3">Méthode de paiement préférée</label>
                <select
                  value={billingSettings.preferred_method}
                  onChange={(e) => updateBillingSettings({ preferred_method: e.target.value })}
                  disabled={updating}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="card">Carte bancaire</option>
                  <option value="paypal">PayPal</option>
                  <option value="paysafecard">Paysafecard</option>
                </select>
              </div>
            )}

            {/* Ajouter une nouvelle méthode de paiement */}
            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-white font-medium mb-4">Ajouter une méthode de paiement</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => window.open('https://billing.stripe.com/p/login/test_00000000000000000000000000', '_blank')}
                  className="flex items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
                >
                  <CreditCard className="w-5 h-5 mr-2 text-blue-400" />
                  <span className="text-white">Carte bancaire</span>
                </button>
                <button
                  onClick={() => window.open('https://www.paypal.com', '_blank')}
                  className="flex items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
                >
                  <div className="w-5 h-5 bg-blue-600 rounded mr-2 flex items-center justify-center text-xs font-bold text-white">P</div>
                  <span className="text-white">PayPal</span>
                </button>
                <button
                  onClick={() => navigate('/payment/paysafecard')}
                  className="flex items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
                >
                  <div className="w-5 h-5 bg-purple-600 rounded mr-2 flex items-center justify-center text-xs font-bold text-white">P</div>
                  <span className="text-white">Paysafecard</span>
                </button>
              </div>
            </div>

            {/* Renouvellement automatique */}
            {billingSettings && (
              <div className="space-y-4">
                <h4 className="text-white font-medium">Renouvellement automatique</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-blue-400" />
                      <span className="text-white">Carte bancaire</span>
                    </div>
                    <button
                      onClick={() => updateBillingSettings({ card_auto_renew: !billingSettings.card_auto_renew })}
                      disabled={updating}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        billingSettings.card_auto_renew ? 'bg-red-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          billingSettings.card_auto_renew ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-xs font-bold text-white">P</div>
                      <span className="text-white">PayPal</span>
                    </div>
                    <button
                      onClick={() => updateBillingSettings({ paypal_auto_renew: !billingSettings.paypal_auto_renew })}
                      disabled={updating}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        billingSettings.paypal_auto_renew ? 'bg-red-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          billingSettings.paypal_auto_renew ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl opacity-60">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center text-xs font-bold text-white">P</div>
                      <div>
                        <span className="text-white">Paysafecard</span>
                        <p className="text-xs text-gray-400">Renouvellement manuel uniquement</p>
                      </div>
                    </div>
                    <div className="text-gray-500 text-sm">Non applicable</div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications de rappel */}
            {billingSettings && (
              <div>
                <label className="block text-white font-medium mb-3">Rappel avant expiration</label>
                <div className="flex items-center space-x-4">
                  <select
                    value={billingSettings.notify_before_days}
                    onChange={(e) => updateBillingSettings({ notify_before_days: parseInt(e.target.value) })}
                    disabled={updating}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value={1}>1 jour avant</option>
                    <option value={2}>2 jours avant</option>
                    <option value={3}>3 jours avant</option>
                    <option value={7}>7 jours avant</option>
                  </select>
                  <button
                    onClick={() => {
                      toast({
                        title: "Paramètres sauvegardés",
                        description: "Vos préférences ont été mises à jour",
                      });
                    }}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  Vous recevrez une notification avant l'expiration de votre abonnement
                </p>
              </div>
            )}

            {/* Actions rapides */}
            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-white font-medium mb-4">Actions rapides</h4>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => window.open('https://billing.stripe.com/p/login/test_00000000000000000000000000', '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Portail client
                </button>
                <button
                  onClick={() => navigate('/subscription')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Changer de plan
                </button>
                <button
                  onClick={refreshSubscription}
                  disabled={loading}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Actualisation...' : 'Actualiser'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatus;