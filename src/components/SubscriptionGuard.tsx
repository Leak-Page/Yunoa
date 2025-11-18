import React, { useEffect, useState, useMemo } from 'react';
import { Crown, Lock, Star, Zap } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showPaywall?: boolean;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
  children,
  fallback,
  showPaywall = true
}) => {
  const { isSubscribed, loading } = useSubscription();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Mémoriser l'état de chargement pour éviter les rerenders
  const isLoadingAll = useMemo(() => 
    authLoading || loading, 
    [authLoading, loading]
  );

  // Mémoriser le statut de l'utilisateur
  const userStatus = useMemo(() => ({
    isLoggedIn: !!user,
    hasSubscription: isSubscribed,
    userId: user?.id
  }), [user?.id, isSubscribed]);

  // Log pour debug (à retirer en production)
  useEffect(() => {
    if (!isLoadingAll) {
      console.log('🛡️ SubscriptionGuard état:', userStatus);
    }
  }, [isLoadingAll, userStatus]);

  // Afficher le loader tant que les données ne sont pas chargées
  if (isLoadingAll) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-white text-sm">Vérification de l'abonnement...</p>
        </div>
      </div>
    );
  }

  // Si pas connecté
  if (!userStatus.isLoggedIn) {
    if (fallback) return <>{fallback}</>;
    if (!showPaywall) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700 overflow-hidden">
          <div className="relative bg-gradient-to-r from-red-600 to-pink-600 p-8 text-center">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative z-10">
              <Lock className="w-16 h-16 text-yellow-300 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">Connexion requise</h1>
              <p className="text-red-100 text-lg">Veuillez vous connecter pour accéder à ce contenu</p>
            </div>
          </div>
          <div className="p-8">
            <div className="flex flex-col gap-4">
              <button
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25"
              >
                Se connecter
              </button>
              <button
                onClick={() => navigate('/')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si connecté mais pas d'abonnement
  if (!userStatus.hasSubscription) {
    if (fallback) return <>{fallback}</>;
    if (!showPaywall) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700 overflow-hidden">
          <div className="relative bg-gradient-to-r from-red-600 to-pink-600 p-8 text-center">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative z-10">
              <Crown className="w-16 h-16 text-yellow-300 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">Contenu Premium</h1>
              <p className="text-red-100 text-lg">Abonnement requis pour accéder à ce contenu</p>
            </div>
          </div>
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-6">
                <Lock className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Débloquez un monde de divertissement
              </h2>
              <p className="text-gray-300 text-lg leading-relaxed">
                Accédez à notre bibliothèque complète de films et séries en streaming haute qualité, 
                sans publicité et avec du contenu exclusif.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-start space-x-3">
                <Star className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-semibold mb-1">Contenu exclusif</h3>
                  <p className="text-gray-400 text-sm">Films et séries premium non disponibles ailleurs</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Zap className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-semibold mb-1">Sans publicité</h3>
                  <p className="text-gray-400 text-sm">Regardez vos contenus sans interruption</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Crown className="w-6 h-6 text-purple-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-semibold mb-1">Qualité HD/4K</h3>
                  <p className="text-gray-400 text-sm">Streaming en haute définition</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Lock className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-white font-semibold mb-1">Accès complet</h3>
                  <p className="text-gray-400 text-sm">Tous les contenus débloqués</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/subscription')}
                className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25"
              >
                Voir les plans d'abonnement
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300"
              >
                Retour à l'accueil
              </button>
            </div>
            <p className="text-gray-500 text-sm text-center mt-6">
              Déjà abonné ? Actualisez la page ou vérifiez votre statut d'abonnement
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Utilisateur connecté avec abonnement actif
  return <>{children}</>;
};

export default SubscriptionGuard;