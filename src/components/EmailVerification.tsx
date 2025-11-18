import { useState, useEffect, useRef } from 'react';
import { Mail, CheckCircle, ArrowLeft, Loader, Clock, RefreshCw, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const EmailVerification = ({ email, onVerified, onBack }) => {
  const [codes, setCodes] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [autoSent, setAutoSent] = useState(false);
  const inputRefs = useRef([]);

  // Envoi automatique au chargement
  useEffect(() => {
    if (!autoSent) {
      handleSendCode();
      setAutoSent(true);
    }
  }, [autoSent]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-verification when code is complete
  useEffect(() => {
    const fullCode = codes.join('');
    if (fullCode.length === 6 && /^\d{6}$/.test(fullCode)) {
      handleVerifyCode(fullCode);
    }
  }, [codes]);

  const handleSendCode = async () => {
    setIsSending(true);
    setError('');
    setSuccess('');
    
    try {
      // L'edge function génère automatiquement le code
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          type: 'verification'
        }
      });

      if (error) throw error;
      
      setSuccess('Code de vérification envoyé par email !');
      setCountdown(60); // Countdown de 60 secondes
    } catch (error) {
      setError(error.message || 'Erreur lors de l\'envoi du code');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async (codeToVerify) => {
    if (!codeToVerify || codeToVerify.length !== 6) {
      setError('Veuillez saisir un code de 6 chiffres');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-email-code', {
        body: { email, code: codeToVerify }
      });

      if (error) throw error;
      
      if (data?.success) {
        setSuccess('Email vérifié avec succès !');
        setTimeout(() => onVerified(), 1000);
      } else {
        throw new Error(data?.error || 'Code invalide');
      }
    } catch (error) {
      setError(error.message || 'Code invalide ou expiré');
      // Réinitialiser les inputs en cas d'erreur
      setCodes(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (index, value) => {
    // Ne garder que les chiffres
    const numericValue = value.replace(/\D/g, '');
    
    if (numericValue.length <= 1) {
      const newCodes = [...codes];
      newCodes[index] = numericValue;
      setCodes(newCodes);

      // Aller au champ suivant automatiquement
      if (numericValue && index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      // Revenir au champ précédent si vide
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newCodes = pastedData.split('');
      setCodes(newCodes);
      // Focus sur le dernier input
      if (inputRefs.current[5]) {
        inputRefs.current[5].focus();
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 via-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Vérification Email</h1>
            <p className="text-gray-400">Code envoyé automatiquement à</p>
            <p className="text-red-400 font-medium">{email}</p>
          </div>

          {/* Form Card */}
          <div className="bg-black/80 backdrop-blur-2xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
            <div className="space-y-6">
              {/* Error/Success Messages */}
              {error && (
                <div className="bg-gradient-to-r from-red-900/40 to-pink-900/40 border border-red-500/50 text-red-300 px-4 py-4 rounded-2xl text-sm backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/50 text-green-300 px-4 py-4 rounded-2xl text-sm backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{success}</span>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-900/20 border border-blue-500/30 text-blue-300 px-4 py-3 rounded-2xl text-sm">
                <div className="flex items-start space-x-2">
                  <Copy className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Conseils :</p>
                    <ul className="text-xs space-y-1 text-blue-200">
                      <li>• Saisir ou coller le code à 6 chiffres</li>
                      <li>• La vérification est automatique</li>
                      <li>• Vérifiez vos spams si besoin</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Code Inputs */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300 text-center">
                  Code de vérification
                </label>
                <div className="flex justify-center space-x-3">
                  {codes.map((code, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      value={code}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="w-12 h-14 bg-gray-900/60 border border-gray-600/50 text-white rounded-xl text-center text-xl font-mono font-bold focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all backdrop-blur-sm"
                      maxLength={1}
                      disabled={isLoading}
                    />
                  ))}
                </div>
                
                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-center justify-center space-x-2 text-gray-400">
                    <Loader className="animate-spin h-4 w-4" />
                    <span className="text-sm">Vérification en cours...</span>
                  </div>
                )}
              </div>

              {/* Resend Code */}
              <div className="text-center space-y-4">
                <p className="text-gray-400 text-sm">
                  Vous n'avez pas reçu le code ?
                </p>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isSending || countdown > 0}
                  className="text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mx-auto"
                >
                  {isSending ? (
                    <>
                      <Loader className="animate-spin h-4 w-4" />
                      <span>Envoi en cours...</span>
                    </>
                  ) : countdown > 0 ? (
                    <>
                      <Clock className="h-4 w-4" />
                      <span>Renvoyer dans {formatTime(countdown)}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>Renvoyer le code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Back Button */}
              <button
                type="button"
                onClick={onBack}
                className="w-full flex items-center justify-center space-x-2 text-gray-400 hover:text-white transition-colors py-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour à l'inscription</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;