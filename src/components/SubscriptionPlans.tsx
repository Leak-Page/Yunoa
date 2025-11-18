import { useState, useEffect } from 'react';
import { Crown, Check, CreditCard, X, Loader2, MessageCircle, Shield, Star } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  currency: string;
  interval: string;
  has_ads: boolean;
  is_active: boolean;
}

interface SubscriptionPlansProps {
  onClose?: () => void;
  showAsModal?: boolean;
}

const SubscriptionPlans = ({ onClose, showAsModal = false }: SubscriptionPlansProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'paypal' | 'paysafecard' | 'crypto'>('paypal');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_cents', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des plans:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les plans d'abonnement",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string, planCode: string) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Vous devez être connecté pour souscrire à un abonnement",
        variant: "destructive"
      });
      return;
    }

    setSubscribing(planId);

    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      const amount = plan.price_cents / 100;

      // PayPal/Carte via Stripe
      if (selectedPaymentMethod === 'paypal') {
        const { data, error } = await supabase.functions.invoke('create-subscription', {
          body: {
            plan_id: plan.id,
            plan_code: plan.code,
            payment_method: 'paypal'
          }
        });

        if (error) {
          throw new Error(error.message || 'Erreur lors de la création du paiement');
        }

        if (data?.payment_url) {
          window.open(data.payment_url, '_blank');
          
          toast({
            title: "Paiement en cours",
            description: `Redirection vers le paiement pour ${data.plan_name}. Votre abonnement sera activé automatiquement après paiement.`,
          });
        }
      }
      // Paysafecard - ticket Discord obligatoire
      else if (selectedPaymentMethod === 'paysafecard') {
        toast({
          title: "Paiement Paysafecard - Ticket Discord requis",
          description: "Pour ce mode de paiement, veuillez créer un ticket sur notre Discord",
          variant: "default"
        });
        
        window.open('https://discord.gg/y8JjdGZNcn', '_blank');
      }
      // Crypto - envoi direct SOL
      else if (selectedPaymentMethod === 'crypto') {
        const solanaWallet = '6PPPGwm4rfBWHHYkgA2JvDgEuxbRh2Y9rJxLEX9yJzSM';
        
        toast({
          title: "Paiement Crypto (Solana)",
          description: `Envoyez vos SOL à cette adresse : ${solanaWallet}`,
          variant: "default"
        });
        
        // Copier l'adresse dans le presse-papier
        navigator.clipboard.writeText(solanaWallet);
        
        setTimeout(() => {
          toast({
            title: "Adresse copiée !",
            description: "L'adresse Solana a été copiée dans votre presse-papier",
          });
        }, 1000);
      }

    } catch (error: any) {
      console.error('Erreur lors de la souscription:', error);
      toast({
        title: "Erreur de souscription",
        description: error.message || "Une erreur s'est produite lors de la souscription",
        variant: "destructive"
      });
    } finally {
      setSubscribing(null);
    }
  };

  const formatPrice = (priceCents: number, currency: string) => {
    return (priceCents / 100).toLocaleString('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase()
    });
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'paypal':
        return (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold text-white">
            PP
          </div>
        );
      case 'paysafecard':
        return <CreditCard className="w-8 h-8 text-green-500" />;
      case 'crypto':
        return (
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Star className="w-5 h-5 text-white" />
          </div>
        );
      default:
        return <CreditCard className="w-8 h-8" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'paypal':
        return 'PayPal (avec carte)';
      case 'paysafecard':
        return 'Paysafecard';
      case 'crypto':
        return 'Crypto (SOL)';
      default:
        return method;
    }
  };

  const getPlanFeatures = (planCode: string) => {
    const baseFeatures = [
      "Accès à tous les contenus",
      "Streaming HD",
      "Support client 24/7"
    ];

    switch (planCode) {
      case 'basic_monthly':
        return [
          ...baseFeatures,
          "Publicités incluses",
          "1 écran simultané",
          "Qualité Standard (720p)"
        ];
      case 'premium_monthly':
        return [
          ...baseFeatures,
          "Sans publicité",
          "3 écrans simultanés",
          "Ultra HD (4K)",
          "Téléchargements hors ligne"
        ];
      case 'lifetime':
        return [
          ...baseFeatures,
          "Sans publicité",
          "5 écrans simultanés",
          "Ultra HD (4K)",
          "Accès prioritaire aux nouveautés",
          "Badge membre VIP"
        ];
      default:
        return baseFeatures;
    }
  };

  const content = (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-6">
          <Crown className="w-12 h-12 text-yellow-500 mr-4" />
          <h1 className="text-4xl font-bold text-white">
            Choisissez votre plan
          </h1>
        </div>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Profitez d'un accès illimité à nos contenus exclusifs
        </p>
      </div>

      {/* Payment Methods */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
          <Shield className="w-6 h-6 mr-3 text-green-500" />
          Mode de paiement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['paypal', 'paysafecard', 'crypto'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setSelectedPaymentMethod(method)}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                selectedPaymentMethod === method
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex flex-col items-center space-y-3">
                {getPaymentMethodIcon(method)}
                <span className="text-white font-medium">
                  {getPaymentMethodLabel(method)}
                </span>
                {selectedPaymentMethod === method && (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isPopular = plan.code === 'premium_monthly';
            const isLifetime = plan.code === 'lifetime';
            
            return (
              <div
                key={plan.id}
                className={`relative bg-card rounded-2xl border p-8 transition-all duration-300 hover:scale-105 ${
                  isPopular ? 'border-primary shadow-lg shadow-primary/25' : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-bold">
                      ⭐ POPULAIRE
                    </div>
                  </div>
                )}
                
                {isLifetime && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-bold">
                      👑 MEILLEURE VALEUR
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {plan.name}
                  </h3>
                  <div className="text-4xl font-bold text-white mb-2">
                    {formatPrice(plan.price_cents, plan.currency)}
                  </div>
                  <p className="text-muted-foreground">
                    {plan.interval === 'lifetime' ? 'Paiement unique' : `par ${plan.interval === 'month' ? 'mois' : plan.interval}`}
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-8">
                  {getPlanFeatures(plan.code).map((feature, idx) => (
                    <div key={idx} className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-green-500" />
                      </div>
                      <span className="text-muted-foreground text-sm">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subscribe Button */}
                <button
                  onClick={() => handleSubscribe(plan.id, plan.code)}
                  disabled={subscribing === plan.id}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
                    isPopular || isLifetime
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  } disabled:opacity-50`}
                >
                  {subscribing === plan.id ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Traitement...</span>
                    </div>
                  ) : (
                    `Choisir ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Info */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-green-500" />
          Informations de paiement
        </h4>
        <div className="text-muted-foreground space-y-3">
          {selectedPaymentMethod === 'paypal' && (
            <div className="bg-muted/50 rounded-xl p-4">
              <p>
                <strong className="text-blue-400">PayPal :</strong> Paiement sécurisé via PayPal. 
                Vous pouvez payer avec votre compte PayPal ou directement par carte bancaire.
              </p>
            </div>
          )}
          {selectedPaymentMethod === 'paysafecard' && (
            <div className="bg-muted/50 rounded-xl p-4">
              <p>
                <strong className="text-green-400">Paysafecard :</strong> Créez un ticket sur notre Discord - 
                <a href="https://discord.gg/y8JjdGZNcn" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline ml-1">
                  discord.gg/y8JjdGZNcn
                </a>
              </p>
            </div>
          )}
          {selectedPaymentMethod === 'crypto' && (
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="mb-2">
                <strong className="text-purple-400">Crypto (Solana) :</strong> Envoyez vos SOL à cette adresse :
              </p>
              <div className="bg-background rounded-lg p-3 border">
                <code className="text-purple-300 text-sm break-all">
                  6PPPGwm4rfBWHHYkgA2JvDgEuxbRh2Y9rJxLEX9yJzSM
                </code>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Support */}
      <div className="bg-card rounded-2xl border border-border p-6 text-center">
        <MessageCircle className="w-8 h-8 text-blue-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-white mb-2">Besoin d'aide ?</h4>
        <p className="text-muted-foreground mb-4">
          Pour tout problème, créez un ticket sur notre Discord
        </p>
        <a
          href="https://discord.gg/y8JjdGZNcn"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-xl transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Support Discord</span>
        </a>
      </div>
    </div>
  );

  if (showAsModal) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-border rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Plans d'abonnement
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
          <div className="p-6">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 px-4">
      <div className="max-w-6xl mx-auto">
        {content}
      </div>
    </div>
  );
};

export default SubscriptionPlans;