import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const PaysafecardPayment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const { toast } = useToast();
  
  const [pinCode, setPinCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  const paymentId = searchParams.get('payment_id');
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency');
  const planName = searchParams.get('plan');

  useEffect(() => {
    if (!user || !paymentId || !amount) {
      navigate('/subscription');
    }
  }, [user, paymentId, amount, navigate]);

  const formatPrice = (cents: string, curr: string) => {
    return (parseInt(cents) / 100).toLocaleString('fr-FR', {
      style: 'currency',
      currency: curr?.toUpperCase() || 'EUR'
    });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pinCode || pinCode.length < 16) {
      toast({
        title: "Code PIN invalide",
        description: "Veuillez entrer un code PIN Paysafecard valide (16 chiffres)",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // Simulation du processus de paiement Paysafecard
      // Dans un vrai système, ceci irait vers l'API Paysafecard
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Pour cette démo, on simule un succès
      setPaymentSuccess(true);
      await refreshSubscription();
      
      toast({
        title: "Paiement réussi",
        description: `Votre abonnement ${planName} a été activé avec succès`,
      });

      // Rediriger vers la page de succès après 2 secondes
      setTimeout(() => {
        navigate('/subscription/success');
      }, 2000);

    } catch (error) {
      toast({
        title: "Erreur de paiement",
        description: "Une erreur est survenue lors du traitement de votre paiement",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Paiement réussi !</h1>
          <p className="text-gray-300 mb-4">
            Votre abonnement {planName} a été activé avec succès.
          </p>
          <div className="animate-pulse text-gray-400 text-sm">
            Redirection en cours...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center">
          <CreditCard className="w-12 h-12 text-white mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Paiement Paysafecard</h1>
          <p className="text-purple-100">Sécurisé et anonyme</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Order Summary */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
            <h3 className="text-white font-semibold mb-2">Récapitulatif de commande</h3>
            <div className="flex justify-between items-center text-gray-300">
              <span>Plan {planName}</span>
              <span className="font-bold text-white">
                {amount && currency && formatPrice(amount, currency)}
              </span>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handlePayment} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Code PIN Paysafecard (16 chiffres)
              </label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 16))}
                placeholder="1234 5678 9012 3456"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
                maxLength={16}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Entrez le code PIN de votre carte Paysafecard
              </p>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-blue-300 font-medium text-sm">Sécurité</h4>
                  <p className="text-blue-200 text-xs">
                    Votre code PIN Paysafecard est traité de manière sécurisée. 
                    Assurez-vous d'avoir suffisamment de crédit sur votre carte.
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate('/subscription')}
                className="flex-1 px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </button>
              
              <Button
                type="submit"
                disabled={processing || pinCode.length < 16}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Traitement...
                  </div>
                ) : (
                  'Confirmer le paiement'
                )}
              </Button>
            </div>
          </form>

          {/* Help */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Problème avec votre carte ? 
              <a href="#" className="text-purple-400 hover:text-purple-300 ml-1">
                Contactez le support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaysafecardPayment;