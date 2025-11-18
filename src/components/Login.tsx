
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, Sparkles, Shield, Star, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/ApiService';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  
  const { login, isAuthLoading, error, clearError, user } = useAuth();
  const navigate = useNavigate();

  // Redirection automatique si déjà connecté
  useEffect(() => {
    if (user && !isAuthLoading) {
      navigate('/', { replace: true });
    }
  }, [user, isAuthLoading, navigate]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      return;
    }

    clearError();
    const success = await login(username, password);
    if (success) {
      // Laisser le contexte d'auth gérer la redirection naturellement
      // La redirection se fera automatiquement via onAuthStateChange
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    
    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordError('Veuillez saisir votre adresse email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      setForgotPasswordError('Veuillez saisir une adresse email valide');
      return;
    }

    setIsSendingReset(true);
    
    try {
      await apiService.forgotPassword(forgotPasswordEmail);
      setForgotPasswordSuccess('Email de réinitialisation envoyé ! Vérifiez votre boîte mail.');
    } catch (error: any) {
      setForgotPasswordError(error.message || 'Erreur lors de l\'envoi de l\'email');
    } finally {
      setIsSendingReset(false);
    }
  };

  if (showForgotPassword) {
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
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-red-600 via-red-500 to-pink-600 bg-clip-text text-transparent">
                  YUNOA
                </h1>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-black/80 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-white mb-3">Mot de passe oublié</h2>
                <p className="text-gray-400">Saisissez votre email pour recevoir un lien de réinitialisation</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                {/* Error Messages */}
                {forgotPasswordError && (
                  <div className="bg-gradient-to-r from-red-900/40 to-pink-900/40 border border-red-500/50 text-red-300 px-4 py-4 rounded-2xl text-sm backdrop-blur-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span>{forgotPasswordError}</span>
                    </div>
                  </div>
                )}

                {/* Success Messages */}
                {forgotPasswordSuccess && (
                  <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/50 text-green-300 px-4 py-4 rounded-2xl text-sm backdrop-blur-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span>{forgotPasswordSuccess}</span>
                    </div>
                  </div>
                )}
                
                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="forgotEmail" className="block text-sm font-medium text-gray-300">
                    Adresse email
                  </label>
                  <div className="relative group">
                    <input
                      type="email"
                      id="forgotEmail"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl px-4 py-4 pl-12 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm group-hover:border-gray-500/70"
                      placeholder="votre@email.com"
                      disabled={isSendingReset}
                    />
                    <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-red-800 disabled:to-pink-800 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                >
                  {isSendingReset ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Envoyer le lien de réinitialisation'
                  )}
                </button>

                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-gray-400 hover:text-white transition-colors py-2"
                >
                  Retour à la connexion
                </button>
              </form>
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
            <div className="flex items-center justify-center space-x-6 text-gray-400 text-sm">
              <div className="flex items-center space-x-1">
                <Shield className="w-4 h-4" />
                <span>Sécurisé</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-400" />
                <span>Premium</span>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-black/80 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-3">Bon retour !</h2>
              <p className="text-gray-400">Connectez-vous pour continuer votre expérience</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-gradient-to-r from-red-900/40 to-pink-900/40 border border-red-500/50 text-red-300 px-4 py-4 rounded-2xl text-sm backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span>{error}</span>
                  </div>
                </div>
              )}
              
              {/* Username */}
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                  Nom d'utilisateur ou email
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl px-4 py-4 pl-12 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm group-hover:border-gray-500/70"
                    placeholder="Entrez votre identifiant"
                    disabled={isAuthLoading}
                  />
                  <User className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Mot de passe
                </label>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl px-4 py-4 pl-12 pr-12 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm group-hover:border-gray-500/70"
                    placeholder="Entrez votre mot de passe"
                    disabled={isAuthLoading}
                  />
                  <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
                    disabled={isAuthLoading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-gray-400 hover:text-red-400 transition-colors text-sm"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-red-800 disabled:to-pink-800 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
              >
                {isAuthLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {/* Links & Demo */}
            <div className="mt-8 space-y-6">
              <div className="text-center">
                <p className="text-gray-400">
                  Nouveau sur Yunoa ?{' '}
                  <Link 
                    to="/register" 
                    className="text-white hover:text-red-400 font-medium transition-colors bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text hover:text-transparent"
                  >
                    Inscrivez-vous maintenant
                  </Link>
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
