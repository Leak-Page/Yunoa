/**
 * Lecteur HLS sécurisé avec protections côté client
 */

import Hls from 'hls.js';

interface HLSPlayerOptions {
  videoElement: HTMLVideoElement;
  playlistUrl: string;
  sessionToken: string;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export class HLSPlayer {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement;
  private playlistUrl: string;

  constructor(private options: HLSPlayerOptions) {
    this.videoElement = options.videoElement;
    this.playlistUrl = options.playlistUrl;
  }

  /**
   * Initialise le lecteur HLS avec protections
   */
  async load(): Promise<void> {
    if (Hls.isSupported()) {
      // Utiliser HLS.js pour le streaming
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        xhrSetup: (xhr, url) => {
          // Ajouter les headers de sécurité
          xhr.setRequestHeader('Referer', window.location.origin);
          xhr.setRequestHeader('Origin', window.location.origin);
        }
      });

      this.hls.loadSource(this.playlistUrl);
      this.hls.attachMedia(this.videoElement);

      // Gestion des erreurs
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS] Erreur réseau');
              this.options.onError?.(new Error('Erreur réseau HLS'));
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS] Erreur média');
              this.hls?.recoverMediaError();
              break;
            default:
              console.error('[HLS] Erreur fatale');
              this.options.onError?.(new Error('Erreur fatale HLS'));
              break;
          }
        }
      });

      // Surveiller la progression
      this.hls.on(Hls.Events.FRAG_LOADED, () => {
        if (this.options.onProgress && this.videoElement.duration) {
          const progress = (this.videoElement.currentTime / this.videoElement.duration) * 100;
          this.options.onProgress(progress);
        }
      });

      // Protections côté client
      this.setupProtections();

    } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Support natif HLS (Safari)
      this.videoElement.src = this.playlistUrl;
      this.setupProtections();
    } else {
      throw new Error('HLS non supporté par ce navigateur');
    }
  }

  /**
   * Configure les protections côté client
   */
  private setupProtections(): void {
    // Empêcher le clic droit
    this.videoElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, { capture: true });

    // Empêcher les raccourcis clavier
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    this.videoElement.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // Empêcher le drag & drop
    this.videoElement.addEventListener('dragstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, { capture: true });

    // Empêcher la sélection
    this.videoElement.style.userSelect = 'none';
    this.videoElement.style.webkitUserSelect = 'none';

    // Empêcher l'accès direct au src
    this.videoElement.addEventListener('loadedmetadata', () => {
      try {
        Object.defineProperty(this.videoElement, 'src', {
          get: () => 'blob:about:blank',
          set: () => {},
          configurable: false
        });
      } catch (e) {
        // Ignorer si on ne peut pas redéfinir
      }
    }, { once: true });

    // Désactiver les outils de développement
    const devtools = {
      open: false,
      orientation: null
    };

    const threshold = 160;
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          console.clear();
          console.log('%cAccès refusé', 'color: red; font-size: 50px; font-weight: bold;');
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    
    if (this.videoElement) {
      this.videoElement.src = '';
      this.videoElement.load();
    }
  }
}

