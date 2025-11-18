import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/ApiService';
import { AlertTriangle, Clock, User } from 'lucide-react';

export const BanMessage: React.FC = () => {
  const { user } = useAuth();
  const [banStatus, setBanStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const status = await apiService.getUserBanStatus(user.id);
        setBanStatus(status);
        
        // Si l'utilisateur est banni, on bloque tout
        if (status?.is_banned) {
          setIsBanned(true);
          // Empêcher le scroll et les interactions
          document.body.style.overflow = 'hidden';
          document.body.style.pointerEvents = 'none';
          
          // Créer un overlay qui bloque tout
          const overlay = document.createElement('div');
          overlay.id = 'ban-overlay';
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.95);
            z-index: 999999;
            pointer-events: auto;
          `;
          document.body.appendChild(overlay);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du statut de ban:', error);
      } finally {
        setLoading(false);
      }
    };

    checkBanStatus();

    // Nettoyage lors du démontage du composant
    return () => {
      if (isBanned) {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        const overlay = document.getElementById('ban-overlay');
        if (overlay) {
          overlay.remove();
        }
      }
    };
  }, [user, isBanned]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRemainingTime = (unbanDate: string) => {
    const now = new Date();
    const unban = new Date(unbanDate);
    const diff = unban.getTime() - now.getTime();

    if (diff <= 0) return 'Expiré';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} jour${days > 1 ? 's' : ''} ${hours}h ${minutes}min`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  };

  // Si en cours de chargement ou pas banni, on n'affiche rien
  if (loading || !banStatus?.is_banned) return null;

  // Message de ban qui bloque complètement l'application
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" 
         style={{ zIndex: 1000000, pointerEvents: 'auto' }}>
      <div className="bg-red-900/90 backdrop-blur-xl border border-red-800/50 rounded-2xl p-8 w-full max-w-md">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-red-800/50 p-4 rounded-full">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-red-300 mb-2">
              Compte suspendu
            </h1>
            <p className="text-red-200/80">
              Votre compte a été temporairement suspendu pour violation des conditions d'utilisation.
            </p>
          </div>

          <div className="bg-red-800/30 rounded-lg p-4 space-y-3 text-left">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-300">Banni par</p>
                <p className="text-red-200">{banStatus.banned_by_username}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-300">Raison du ban</p>
                <p className="text-red-200">{banStatus.ban_reason}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-300">Banni le</p>
                <p className="text-red-200">{formatDate(banStatus.banned_at)}</p>
              </div>
            </div>

            {!banStatus.is_permanent && banStatus.unban_at && (
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-orange-300">Unban dans</p>
                  <p className="text-orange-200 font-mono">
                    {getRemainingTime(banStatus.unban_at)}
                  </p>
                </div>
              </div>
            )}

            {banStatus.is_permanent && (
              <div className="bg-red-700/50 rounded p-3 text-center">
                <p className="text-red-200 font-medium">
                  🚫 BAN PERMANENT
                </p>
                <p className="text-red-300 text-sm mt-1">
                  Contactez le support pour plus d'informations
                </p>
              </div>
            )}
          </div>

          <div className="text-sm text-red-300/80">
            Si vous pensez que cette suspension est une erreur, 
            veuillez contacter notre équipe de support.
          </div>
        </div>
      </div>
    </div>
  );
};
