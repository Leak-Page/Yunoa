import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SecurityConfig {
  enableTampermonkeyDetection: boolean;
  enableDevToolsDetection: boolean;
  enableContextMenuProtection: boolean;
  enableKeyboardProtection: boolean;
  enableTextSelectionProtection: boolean;
  enableDOMProtection: boolean;
  enableTokenProtection: boolean;
  devToolsCheckInterval: number;
  maxViolations: number;
  silentMode: boolean;
}

interface SecurityViolation {
  type: string;
  timestamp: number;
  details?: string;
}

const DEFAULT_CONFIG: SecurityConfig = {
  enableTampermonkeyDetection: false,
  enableDevToolsDetection: true,
  enableContextMenuProtection: true,
  enableKeyboardProtection: true,
  enableTextSelectionProtection: false,
  enableDOMProtection: false,
  enableTokenProtection: false,
  devToolsCheckInterval: 5000,
  maxViolations: 10,
  silentMode: true,
};

const SecurityGuard: React.FC<{ 
  children: React.ReactNode; 
  config?: Partial<SecurityConfig>;
  onSecurityViolation?: (violation: SecurityViolation) => void;
  onSecurityBlock?: () => void;
}> = ({ 
  children, 
  config = {}, 
  onSecurityViolation,
  onSecurityBlock 
}) => {
  const [isSecure, setIsSecure] = useState(true);
  const [violations, setViolations] = useState<SecurityViolation[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showMildWarning, setShowMildWarning] = useState(false);
  const [showBlackScreen, setShowBlackScreen] = useState(false);
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const observerRef = useRef<MutationObserver | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tokenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const devToolsOpenRef = useRef(false);
  const originalTokenRef = useRef<string | null>(null);
  const authChallengeRef = useRef<{ step: number; data: any }>({ step: 0, data: {} });

  // Types de violations qui ne déclenchent PAS le blocage
  const NON_BLOCKING_VIOLATIONS = ['context_menu_blocked', 'keyboard_shortcut_blocked', 'screenshot_attempt_blocked'];

  const addViolation = useCallback((type: string, details?: string) => {
    const violation: SecurityViolation = {
      type,
      timestamp: Date.now(),
      details,
    };

    setViolations(prev => {
      const newViolations = [...prev, violation];
      
      // Ne compter que les violations bloquantes pour le déclenchement de la sécurité
      const blockingViolations = newViolations.filter(v => !NON_BLOCKING_VIOLATIONS.includes(v.type));
      
      if (blockingViolations.length >= finalConfig.maxViolations) {
        setIsSecure(false);
        onSecurityBlock?.();
        // Utiliser setTimeout pour éviter l'erreur de setState pendant le render
        setTimeout(() => {
          toast({
            title: "Sécurité",
            description: "Trop de violations critiques détectées. Accès bloqué.",
            variant: "destructive",
          });
        }, 0);
      }

      return newViolations;
    });

    onSecurityViolation?.(violation);
    
    if (!finalConfig.silentMode) {
      console.warn(`[SecurityGuard] Violation détectée: ${type}`, details || '');
    }
  }, [finalConfig.maxViolations, finalConfig.silentMode, onSecurityViolation, onSecurityBlock]);

  const detectTampermonkey = useCallback(() => {
    if (!finalConfig.enableTampermonkeyDetection) return false;

    try {
      // Vérifier les objets globaux Tampermonkey/Greasemonkey
      const tampermonkeyIndicators = [
        'GM_info', 'GM_setValue', 'GM_getValue', 'GM_deleteValue',
        'GM_listValues', 'GM_addStyle', 'GM_getResourceText',
        'unsafeWindow', 'GM_xmlhttpRequest', 'GM_registerMenuCommand'
      ];

      for (const indicator of tampermonkeyIndicators) {
        if ((window as any)[indicator]) {
          addViolation('tampermonkey_detected', `Global object: ${indicator}`);
          return true;
        }
      }

      // Vérifier les scripts Tampermonkey dans le DOM
      const suspiciousScripts = document.querySelectorAll('script[data-name*="tampermonkey"], script[src*="tampermonkey"], script[src*="greasemonkey"]');
      if (suspiciousScripts.length > 0) {
        addViolation('tampermonkey_script_detected', `Scripts trouvés: ${suspiciousScripts.length}`);
        return true;
      }

      // Vérifier les extensions via les propriétés modifiées
      if ((window as any).__TAMPERMONKEY__ || (window as any).__GREASEMONKEY__) {
        addViolation('userscript_extension_detected');
        return true;
      }

    } catch (error) {
      console.warn('[SecurityGuard] Erreur lors de la détection Tampermonkey:', error);
    }

    return false;
  }, [finalConfig.enableTampermonkeyDetection, addViolation]);

  // Système d'authentification complexe pour fragment5685
  const authenticatePrivilegedUser = useCallback(async () => {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user?.email) return false;

      const userEmail = currentUser.data.user.email;
      const timestamp = Date.now();
      const browserFingerprint = [
        navigator.userAgent.slice(0, 50),
        screen.width + 'x' + screen.height,
        navigator.language,
        Intl.DateTimeFormat().resolvedOptions().timeZone
      ].join('|');

      // Étape 1: Vérification email + empreinte
      if (userEmail === 'graditoss@gmail.com') {
        authChallengeRef.current.step = 1;
        authChallengeRef.current.data = { timestamp, fingerprint: browserFingerprint };

        // Étape 2: Challenge temporel (fenêtre de 30s)
        const sessionStart = sessionStorage.getItem('auth_session_start');
        if (!sessionStart || timestamp - parseInt(sessionStart) > 30000) {
          sessionStorage.setItem('auth_session_start', timestamp.toString());
          return false;
        }

        // Étape 3: Vérification des capacités avancées
        const hasAdvancedAccess = await new Promise(resolve => {
          const challenge = Math.random().toString(36).substring(7);
          const expectedResponse = btoa(challenge + browserFingerprint).slice(0, 16);
          
          const userResponse = prompt(`Challenge d'authentification: ${challenge}\nEntrez la réponse:`);
          resolve(userResponse === expectedResponse);
        });

        if (hasAdvancedAccess) {
          setIsAuthorized(true);
          sessionStorage.setItem('privileged_auth', 'true');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.warn('[SecurityGuard] Erreur d\'authentification:', error);
      return false;
    }
  }, []);

  // Protection anti-modification des tokens
  const setupTokenProtection = useCallback(() => {
    if (!finalConfig.enableTokenProtection) return;

    const checkTokenIntegrity = async () => {
      try {
        const session = await supabase.auth.getSession();
        const currentToken = session.data.session?.access_token;

        if (originalTokenRef.current === null && currentToken) {
          originalTokenRef.current = currentToken;
          return;
        }

        if (originalTokenRef.current && currentToken !== originalTokenRef.current) {
          // Token modifié - forcer une re-authentification
          await supabase.auth.signOut();
          addViolation('token_tampering_detected', 'Token utilisateur modifié');
          
          // Utiliser setTimeout pour éviter l'erreur de setState pendant le render
          setTimeout(() => {
            toast({
              title: "Sécurité compromise",
              description: "Votre session a été invalidée pour des raisons de sécurité.",
              variant: "destructive",
            });
          }, 0);
          
          // Redirection vers la page de connexion
          window.location.href = '/login';
        }
      } catch (error) {
        console.warn('[SecurityGuard] Erreur de vérification du token:', error);
      }
    };

    // Vérification toutes les 5 secondes
    tokenIntervalRef.current = setInterval(checkTokenIntegrity, 5000);
    checkTokenIntegrity(); // Vérification initiale
  }, [finalConfig.enableTokenProtection, addViolation]);

  const checkDevTools = useCallback(async () => {
    if (!finalConfig.enableDevToolsDetection) return;

    try {
      const threshold = 200;
      const heightDiff = window.outerHeight - window.innerHeight;
      const widthDiff = window.outerWidth - window.innerWidth;
      
      const isDevToolsOpen = heightDiff > threshold || widthDiff > threshold;
      
      if (isDevToolsOpen && !devToolsOpenRef.current) {
        devToolsOpenRef.current = true;
        addViolation('devtools_opened', `Différence: ${heightDiff}x${widthDiff}`);
        
        if (!finalConfig.silentMode) {
          console.log('%c⚠️ Outils de développement détectés', 'color: #ff6666; font-size: 16px;');
        }
      } else if (!isDevToolsOpen && devToolsOpenRef.current) {
        devToolsOpenRef.current = false;
      }
      
    } catch (error) {
      console.warn('[SecurityGuard] Erreur lors de la vérification des DevTools:', error);
    }
  }, [finalConfig.enableDevToolsDetection, addViolation]);

  const preventKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (!finalConfig.enableKeyboardProtection) return;

    const basicBlocked = [
      // DevTools basiques
      { key: 'F12' },
      { key: 'I', ctrlKey: true, shiftKey: true },
      
      // Screenshots Windows principaux
      { key: 'S', metaKey: true, shiftKey: true }, // Win + Shift + S
    ];

    for (const combo of basicBlocked) {
      const matches = Object.entries(combo).every(([prop, value]) => {
        if (prop === 'key' && typeof value === 'string') {
          return e.key === value || e.key === value.toLowerCase() || e.key === value.toUpperCase();
        }
        return (e as any)[prop] === value;
      });

      if (matches) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        addViolation('keyboard_shortcut_blocked', `Combinaison: ${JSON.stringify(combo)}`);
        
        if (!finalConfig.silentMode) {
          setShowMildWarning(true);
          setTimeout(() => setShowMildWarning(false), 1500);
        }
        return false;
      }
    }
  }, [finalConfig.enableKeyboardProtection, finalConfig.silentMode, addViolation]);

  const preventContextMenu = useCallback((e: MouseEvent) => {
    if (!finalConfig.enableContextMenuProtection) return;
    
    e.preventDefault();
    e.stopImmediatePropagation();
    addViolation('context_menu_blocked');
    
    // UX améliorée - notification discrète au lieu d'un toast intrusif
    if (!finalConfig.silentMode) {
      setShowMildWarning(true);
      setTimeout(() => setShowMildWarning(false), 2000);
    }
    
    return false;
  }, [finalConfig.enableContextMenuProtection, finalConfig.silentMode, addViolation]);

  const preventSelection = useCallback((e: Event) => {
    if (!finalConfig.enableTextSelectionProtection) return;
    
    // Permettre la sélection dans les inputs et textareas
    const target = e.target as Element;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
      return;
    }
    
    e.preventDefault();
    return false;
  }, [finalConfig.enableTextSelectionProtection]);

  const setupDOMProtection = useCallback(() => {
    if (!finalConfig.enableDOMProtection) return;

    observerRef.current = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Vérifier les scripts suspects
              if (element.tagName === 'SCRIPT') {
                const src = element.getAttribute('src');
                const isAllowedScript = 
                  !src || 
                  src.includes('vite') || 
                  src.includes('localhost') ||
                  src.includes(window.location.origin) ||
                  element.hasAttribute('data-allowed');

                if (!isAllowedScript) {
                  console.warn('[SecurityGuard] Script non autorisé supprimé:', src);
                  element.remove();
                  addViolation('suspicious_script_removed', src || 'inline script');
                }
              }
              
              // Vérifier les iframes suspects
              if (element.tagName === 'IFRAME' && !element.hasAttribute('data-allowed')) {
                const src = element.getAttribute('src');
                if (src && !src.startsWith(window.location.origin)) {
                  console.warn('[SecurityGuard] Iframe externe supprimé:', src);
                  element.remove();
                  addViolation('external_iframe_removed', src);
                }
              }
            }
          });
        }
        
        // Surveiller les modifications d'attributs suspects
        if (mutation.type === 'attributes') {
          const element = mutation.target as Element;
          if (mutation.attributeName === 'style' && element.getAttribute('style')?.includes('display: none')) {
            // Potentielle tentative de masquage d'éléments de sécurité
            addViolation('suspicious_style_modification', element.tagName);
          }
        }
      });
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'src']
    });
  }, [finalConfig.enableDOMProtection, addViolation]);

  const setupProtectionStyles = useCallback(() => {
    if (!finalConfig.enableTextSelectionProtection) return;

    styleRef.current = document.createElement('style');
    styleRef.current.setAttribute('data-security-guard', 'true');
    styleRef.current.textContent = `
      /* Protection contre la sélection */
      * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      /* Permettre la sélection dans les champs de saisie */
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      
      /* Protection contre les screenshots via CSS */
      @media print {
        * {
          visibility: hidden !important;
        }
        .print-allowed {
          visibility: visible !important;
        }
      }
      
      /* Masquer le contenu lors de la capture d'écran */
      @media screen {
        body.screenshot-protection {
          background: #000 !important;
          color: transparent !important;
        }
        body.screenshot-protection * {
          background: #000 !important;
          color: transparent !important;
          border-color: #000 !important;
          box-shadow: none !important;
          text-shadow: none !important;
          opacity: 0 !important;
        }
      }
    `;
    
    document.head.appendChild(styleRef.current);
  }, [finalConfig.enableTextSelectionProtection]);

  // Initialisation des protections
  useEffect(() => {
    let mounted = true;

    const initializeSecurity = async () => {
      if (!mounted) return;

      try {
        // Vérifications initiales
        detectTampermonkey();
        
        // Configuration des protections
        setupDOMProtection();
        setupProtectionStyles();
        setupTokenProtection();
        
        // Détection de focus/blur pour les tentatives de capture
        let isPageVisible = true;
        
        const handleVisibilityChange = () => {
          if (document.hidden && isPageVisible) {
            // Page devient cachée - possible capture d'écran
            isPageVisible = false;
            document.body.classList.add('screenshot-protection');
            addViolation('page_visibility_suspicious', 'Changement de visibilité suspect');
            
            setTimeout(() => {
              document.body.classList.remove('screenshot-protection');
            }, 2000);
          } else if (!document.hidden) {
            isPageVisible = true;
          }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Détection de perte de focus suspecte - DÉSACTIVÉE (trop sensible pour les sites de streaming)
        // const handleBlur = () => {
        //   setTimeout(() => {
        //     if (!document.hasFocus()) {
        //       document.body.classList.add('screenshot-protection');
        //       addViolation('focus_loss_suspicious', 'Perte de focus suspecte');
        //       
        //       setTimeout(() => {
        //         document.body.classList.remove('screenshot-protection');
        //       }, 1500);
        //     }
        //   }, 100);
        // };
        
        // window.addEventListener('blur', handleBlur);
        
        // Configuration des intervals
        if (finalConfig.enableDevToolsDetection) {
          intervalRef.current = setInterval(checkDevTools, finalConfig.devToolsCheckInterval);
        }

        // Event listeners
        if (finalConfig.enableKeyboardProtection) {
          document.addEventListener('keydown', preventKeyboardShortcuts, { capture: true });
          document.addEventListener('keyup', preventKeyboardShortcuts, { capture: true });
          
          // Détection des tentatives de capture d'écran via l'API
          if ('getDisplayMedia' in navigator.mediaDevices) {
            const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
            navigator.mediaDevices.getDisplayMedia = function(...args) {
              addViolation('screen_capture_api_blocked', 'Tentative via getDisplayMedia');
              setShowBlackScreen(true);
              setTimeout(() => setShowBlackScreen(false), 3000);
              return Promise.reject(new Error('Capture d\'écran bloquée'));
            };
          }
        }
        
        if (finalConfig.enableContextMenuProtection) {
          document.addEventListener('contextmenu', preventContextMenu, { capture: true });
        }
        
        if (finalConfig.enableTextSelectionProtection) {
          document.addEventListener('selectstart', preventSelection, { capture: true });
          document.addEventListener('dragstart', preventSelection, { capture: true });
        }

        // Protection contre le débogage
        if (finalConfig.enableDevToolsDetection) {
          // Redéfinir console.log pour détecter l'utilisation
          const originalLog = console.log;
          console.log = (...args: any[]) => {
            if (devToolsOpenRef.current) {
              addViolation('console_usage_detected');
            }
            return originalLog.apply(console, args);
          };
        }

      } catch (error) {
        console.error('[SecurityGuard] Erreur lors de l\'initialisation:', error);
      }
    };

    initializeSecurity();

    // Cleanup
    return () => {
      mounted = false;
      
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (tokenIntervalRef.current) {
        clearInterval(tokenIntervalRef.current);
      }
      
      if (styleRef.current && styleRef.current.parentNode) {
        styleRef.current.parentNode.removeChild(styleRef.current);
      }

      document.removeEventListener('keydown', preventKeyboardShortcuts, { capture: true });
      document.removeEventListener('keyup', preventKeyboardShortcuts, { capture: true });
      document.removeEventListener('contextmenu', preventContextMenu, { capture: true });
      document.removeEventListener('selectstart', preventSelection, { capture: true });
      document.removeEventListener('dragstart', preventSelection, { capture: true });
      document.removeEventListener('visibilitychange', () => {});
      window.removeEventListener('blur', () => {});
    };
  }, [
    detectTampermonkey,
    setupDOMProtection,
    setupProtectionStyles,
    checkDevTools,
    preventKeyboardShortcuts,
    preventContextMenu,
    preventSelection,
    addViolation,
    authenticatePrivilegedUser,
    setupTokenProtection,
    finalConfig
  ]);

  // Interface de blocage sécurisé (uniquement pour les violations critiques)
  if (!isSecure) {
    // Filtrer les violations critiques pour l'affichage
    const criticalViolations = violations.filter(v => !NON_BLOCKING_VIOLATIONS.includes(v.type));
    
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="text-center max-w-2xl px-6">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h1 className="text-4xl font-bold mb-4 text-red-400">Accès Refusé</h1>
          </div>
          
          <div className="space-y-4 text-left bg-gray-800/50 rounded-lg p-6">
            <p className="text-xl font-semibold text-center">Violations critiques de sécurité détectées</p>
            <div className="space-y-2">
              {criticalViolations.slice(-3).map((violation, index) => (
                <div key={index} className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="flex-1">
                    {violation.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-gray-400">
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-8 space-y-3 text-gray-300">
            <p className="text-lg">Pour retrouver l'accès :</p>
            <ul className="text-left space-y-2 text-sm">
              <li>• Désactivez toutes les extensions de navigateur</li>
              <li>• Fermez les outils de développement</li>
              <li>• Actualisez la page</li>
              <li>• Utilisez un navigateur en mode navigation privée</li>
            </ul>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Actualiser la page
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {showMildWarning && (
        <div className="fixed top-4 right-4 z-50 bg-background/95 backdrop-blur-sm border border-muted rounded-lg p-3 shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <span>Action non autorisée</span>
          </div>
        </div>
      )}
      {showBlackScreen && (
        <div className="fixed inset-0 z-[10000] bg-black flex items-center justify-center">
          <div className="text-white text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xl font-semibold">Protection Activée</p>
            <p className="text-sm opacity-75 mt-2">Capture d'écran bloquée</p>
          </div>
        </div>
      )}
    </>
  );
};

export default SecurityGuard;