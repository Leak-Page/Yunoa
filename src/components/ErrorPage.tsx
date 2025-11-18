import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Home, AlertTriangle, Wifi, Clock, Shield, Search } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorInfo {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  suggestions: string[];
  code: string;
}

const errorMap: Record<string, ErrorInfo> = {
  VIDEO_NOT_FOUND: {
    title: "Contenu introuvable",
    description: "Cette vidéo n'existe plus ou a été supprimée.",
    icon: Search,
    suggestions: [
      "Vérifiez l'URL de la vidéo",
      "Retournez à l'accueil pour découvrir d'autres contenus",
      "Contactez le support si vous pensez qu'il s'agit d'une erreur"
    ],
    code: "404"
  },
  ACCESS_DENIED: {
    title: "Accès refusé",
    description: "Vous n'avez pas l'autorisation de regarder ce contenu.",
    icon: Shield,
    suggestions: [
      "Vérifiez que vous êtes connecté à votre compte",
      "Assurez-vous d'avoir un abonnement valide",
      "Contactez le support pour plus d'informations"
    ],
    code: "403"
  },
  CONNECTION_TIMEOUT: {
    title: "Connexion expirée",
    description: "Le serveur met trop de temps à répondre.",
    icon: Clock,
    suggestions: [
      "Vérifiez votre connexion internet",
      "Réessayez dans quelques instants",
      "Redémarrez votre routeur si nécessaire"
    ],
    code: "408"
  },
  NETWORK_ERROR: {
    title: "Problème de réseau",
    description: "Impossible de se connecter aux serveurs.",
    icon: Wifi,
    suggestions: [
      "Vérifiez votre connexion internet",
      "Essayez de changer de réseau",
      "Contactez votre fournisseur d'accès"
    ],
    code: "NET"
  },
  RATE_LIMITED: {
    title: "Trop de requêtes",
    description: "Vous avez effectué trop de requêtes. Veuillez patienter.",
    icon: AlertTriangle,
    suggestions: [
      "Attendez quelques minutes avant de réessayer",
      "Évitez de recharger la page plusieurs fois",
      "Contactez le support si le problème persiste"
    ],
    code: "429"
  },
  TOO_MANY_STREAMS: {
    title: "Limite de streams atteinte",
    description: "Vous regardez déjà des vidéos sur d'autres appareils.",
    icon: AlertTriangle,
    suggestions: [
      "Fermez les lecteurs vidéo sur vos autres appareils",
      "Attendez que les autres sessions se terminent",
      "Contactez le support pour augmenter votre limite"
    ],
    code: "STREAM"
  },
  UNKNOWN_ERROR: {
    title: "Erreur inattendue",
    description: "Une erreur technique s'est produite.",
    icon: AlertTriangle,
    suggestions: [
      "Actualisez la page",
      "Videz le cache de votre navigateur",
      "Contactez le support technique"
    ],
    code: "500"
  }
};

const ErrorPage: React.FC = () => {
  const { errorCode = 'UNKNOWN_ERROR' } = useParams<{ errorCode: string }>();
  const navigate = useNavigate();
  
  const error = errorMap[errorCode] || errorMap.UNKNOWN_ERROR;
  const IconComponent = error.icon;

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-32 h-32 bg-primary/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-20 w-40 h-40 bg-accent/5 rounded-full blur-xl"></div>
        </div>

        <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center">
                <IconComponent className="w-12 h-12 text-destructive" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-destructive">{error.code}</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {error.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              {error.description}
            </p>
          </div>

          {/* Suggestions */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
              Que pouvez-vous faire ?
            </h3>
            <ul className="space-y-3">
              {error.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-muted-foreground">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleRetry} 
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
            
            <Button 
              onClick={handleGoBack} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            
            <Button 
              onClick={handleGoHome} 
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Accueil
            </Button>
          </div>

          {/* Error Code Footer */}
          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Code d'erreur: <span className="font-mono font-semibold">{errorCode}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Si le problème persiste, contactez notre support avec ce code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;