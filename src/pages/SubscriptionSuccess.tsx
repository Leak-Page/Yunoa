import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Crown, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const SubscriptionSuccess = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId && user) {
      verifyPayment(sessionId);
    } else {
      setLoading(false);
    }
  }, [searchParams, user]);

  const verifyPayment = async (sessionId: string) => {
    try {
      // Utiliser notre endpoint de vérification pour confirmer le paiement
      const { data: verificationResult, error: verifyError } = await supabase.functions.invoke('verify-payment', {
        body: { session_id: sessionId }
      });

      if (verifyError) {
        console.error('Erreur de vérification du paiement:', verifyError);
        // Fallback vers la vérification directe
        await fallbackVerification();
        return;
      }

      if (verificationResult?.payment_verified) {
        // Paiement vérifié et abonnement activé automatiquement
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select(`
            *,
            subscription_plans:plan_id (name, price_cents, currency, interval)
          `)
          .eq('user_id', user?.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscription) {
          setSubscriptionData(subscription);
        } else {
          console.warn('Paiement vérifié mais abonnement non trouvé');
          await fallbackVerification();
        }
      } else {
        // Paiement non encore vérifié
        await fallbackVerification();
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du paiement:', error);
      await fallbackVerification();
    } finally {
      setLoading(false);
    }
  };

  const fallbackVerification = async () => {
    try {
      // Attendre plus longtemps pour les webhooks
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans:plan_id (name, price_cents, currency, interval)
        `)
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription) {
        setSubscriptionData(subscription);
      }
    } catch (error) {
      console.error('Erreur de vérification fallback:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {loading ? (
          <div className="space-y-8">
            <Loader2 className="w-16 h-16 animate-spin text-green-500 mx-auto" />
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Vérification de votre paiement...
              </h1>
              <p className="text-gray-400">
                Nous traitons votre abonnement, veuillez patienter.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Animation de succès */}
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -inset-4 bg-green-500/20 rounded-full animate-ping"></div>
            </div>

            {/* Message principal */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-white">
                🎉 Bienvenue chez Yunoa Premium !
              </h1>
              <p className="text-xl text-gray-300">
                Votre abonnement a été activé avec succès
              </p>
            </div>

            {/* Détails de l'abonnement */}
            {subscriptionData && (
              <div className="bg-gray-900/50 border border-gray-700 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex items-center justify-center mb-6">
                  <Crown className="w-8 h-8 text-yellow-500 mr-3" />
                  <h2 className="text-2xl font-bold text-white">
                    {subscriptionData.subscription_plans?.name}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Plan :</span>
                      <span className="text-white font-medium">
                        {subscriptionData.subscription_plans?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Prix :</span>
                      <span className="text-white font-medium">
                        {(subscriptionData.subscription_plans?.price_cents / 100).toFixed(2)}€
                        {subscriptionData.subscription_plans?.interval === 'month' && '/mois'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Statut :</span>
                      <span className="text-green-400 font-medium">✅ Actif</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Méthode :</span>
                      <span className="text-white font-medium capitalize">
                        {subscriptionData.payment_method}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Avantages */}
            <div className="bg-gradient-to-r from-red-900/20 to-pink-900/20 border border-red-500/30 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">
                🚀 Vos avantages Premium
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  '📺 Accès illimité à tous les contenus',
                  '🎬 Streaming en Ultra HD (4K)',
                  '📱 Visionnage sur tous vos appareils',
                  '⚡ Pas de publicité',
                  '💾 Téléchargements hors ligne',
                  '🎯 Recommandations personnalisées',
                  '👑 Badge membre Premium',
                  '📞 Support prioritaire 24/7'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 text-gray-300">
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/')}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center space-x-2"
              >
                <span>Commencer à regarder</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => navigate('/settings')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-xl font-bold transition-all"
              >
                Gérer mon abonnement
              </button>
            </div>

            {/* Note de bas de page */}
            <p className="text-gray-500 text-sm">
              Un email de confirmation vous a été envoyé avec tous les détails de votre abonnement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionSuccess;