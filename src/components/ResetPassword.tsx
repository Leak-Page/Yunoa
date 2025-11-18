
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Sparkles, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Vérifier si nous avons une session active (utilisateur venant du lien email)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Lien de réinitialisation invalide ou expiré');
      }
    };

    checkSession();
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setValidationError('');
    setError('');
    
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setValidationError('Veuillez remplir tous les champs');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 6) {
      setValidationError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccess(true);
      
      // Rediriger vers la page de connexion après 3 secondes
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-green-600/10 via-transparent to-transparent"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-t from-green-600/5 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-gradient-to-br from-emerald-600/5 to-green-600/5 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-600 via-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">Mot de passe réinitialisé !</h1>
              <p className="text-gray-400">Votre mot de passe a été modifié avec succès.</p>
              <p className="text-gray-400 mt-2">Redirection vers la page de connexion...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-red-600/10 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-t from-red-600/5 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-gradient-to-br from-purple-600/5 to-pink-600/5 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo & Branding */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 via-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl mr-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-red-600 via-red-500 to-pink-600 bg-clip-text text-transparent">
                YUNOA
              </h1>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-black/80 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-3">Nouveau mot de passe</h2>
              <p className="text-gray-400">Saisissez votre nouveau mot de passe</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Messages */}
              {(error || validationError) && (
                <div className="bg-gradient-to-r from-red-900/40 to-pink-900/40 border border-red-500/50 text-red-300 px-4 py-4 rounded-2xl text-sm backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span>{error || validationError}</span>
                  </div>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-2">
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300">
                  Nouveau Mot de passe:
                </label>
                <div className="relative group">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl px-4 py-4 pl-12 pr-12 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm group-hover:border-gray-500/70"
                    placeholder="Minimum 6 caractères"
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                  Confirmation de votre Mot de passe:
                </label>
                <div className="relative group">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl px-4 py-4 pl-12 pr-12 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm group-hover:border-gray-500/70"
                    placeholder="Confirmez votre mot de passe"
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-red-800 disabled:to-pink-800 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Changer le mot de passe'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
