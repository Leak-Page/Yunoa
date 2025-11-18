import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Mail, Lock, Sparkles, Shield, Star, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EmailVerification from './EmailVerification';
import SubscriptionPlans from './SubscriptionPlans';
import { tempEmailDomains, isEmailBlocked } from '../context/EmailBlacklist';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [showSubscriptionPlans, setShowSubscriptionPlans] = useState(false);
  
 const { register, isLoading, error, clearError, user } = useAuth();
  const navigate = useNavigate();

  // Redirection automatique si déjà connecté
  useEffect(() => {
    if (user && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Fonction pour vérifier si un email est bloqué (DEPRECATED - utilise la nouvelle fonction)
  const isTemporaryEmailDomain = (email) => {
    const result = isEmailBlocked(email);
    return result.blocked;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setValidationError('');
    
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setValidationError('Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setValidationError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Veuillez saisir une adresse email valide');
      return;
    }

    // Vérification complète des emails non autorisés
    const emailValidation = isEmailBlocked(email);
    if (emailValidation.blocked) {
      setValidationError(emailValidation.reason);
      return;
    }

    clearError();
    setShowEmailVerification(true);
  };

  const handleEmailVerified = async () => {
    const success = await register(username, email, password);
    if (success) {
      setShowEmailVerification(false);
      setShowSubscriptionPlans(true);
    } else {
      setShowEmailVerification(false);
    }
  };

  const handleBackToRegister = () => {
    setShowEmailVerification(false);
  };

  if (showEmailVerification) {
    return (
      <EmailVerification
        email={email}
        onVerified={handleEmailVerified}
        onBack={handleBackToRegister}
      />
    );
  }

  if (showSubscriptionPlans) {
    return (
      <SubscriptionPlans 
        showAsModal={true}
        onClose={() => {
          setShowSubscriptionPlans(false);
          navigate('/');
        }}
      />
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
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Gratuit</span>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-black/80 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-3">Rejoignez Yunoa</h2>
              <p className="text-gray-400">Créez votre compte et découvrez nos contenus exclusifs</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Messages */}
              {(error || validationError) && (
                <div className="bg-gradient-to-r from-red-900/50 to-pink-900/50 border-2 border-red-500/70 text-red-200 px-6 py-5 rounded-2xl backdrop-blur-sm shadow-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-100 mb-1">Erreur de validation</h4>
                      <p className="text-sm leading-relaxed">{error || validationError}</p>
                      {validationError && validationError.includes('email') && (
                        <div className="mt-3 text-xs text-red-300 bg-red-900/30 p-3 rounded-lg border border-red-700/50">
                          <p className="font-medium mb-2">📧 Types d'emails non autorisés :</p>
                          <ul className="space-y-1 text-red-200">
                            <li>• Services temporaires (10minutemail, guerrillamail, yopmail...)</li>
                            <li>• Alias Gmail avec "+" (exemple+spam@gmail.com)</li>
                            <li>• Gmail avec trop de points (a.b.c.d@gmail.com)</li>
                            <li>• Ancien domaine Gmail (@googlemail.com)</li>
                            <li>• Domaines de test (@example.com, @test.com...)</li>
                          </ul>
                          <p className="mt-2 text-red-100 font-medium">💡 Utilisez une adresse email personnelle permanente</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Username */}
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                  Nom d'utilisateur
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl px-4 py-4 pl-12 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm group-hover:border-gray-500/70"
                    placeholder="Choisissez un nom d'utilisateur"
                    disabled={isLoading}
                  />
                  <User className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  Adresse email
                </label>
                <div className="relative group">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-600/50 text-white rounded-2xl px-4 py-4 pl-12 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm group-hover:border-gray-500/70"
                    placeholder="votre@email.com"
                    disabled={isLoading}
                  />
                  <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                </div>
                <p className="text-xs text-gray-500">
                  Non autorisés : emails temporaires, alias Gmail (+), domaines de test, @googlemail.com
                </p>
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
                    placeholder="Minimum 6 caractères"
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                  Confirmer le mot de passe
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
                   'Continuer vers la vérification'
                 )}
              </button>
            </form>

            {/* Links */}
            <div className="mt-8">
              <div className="text-center">
                <p className="text-gray-400">
                  Déjà membre ?{' '}
                  <Link 
                    to="/login" 
                    className="text-white hover:text-red-400 font-medium transition-colors bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text hover:text-transparent"
                  >
                    Connectez-vous
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

export default Register;
