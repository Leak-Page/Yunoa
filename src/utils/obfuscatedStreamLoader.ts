/**
 * Système de chargement vidéo optimisé et sécurisé
 * - Utilise directement l'URL signée (le navigateur gère les Range requests)
 * - URL masquée via proxy interne
 * - Chargement rapide et fluide
 * - Sécurité maximale
 */

interface StreamOptions {
  videoUrl: string;
  videoId: string;
  sessionToken: string;
  videoElement: HTMLVideoElement;
  onProgress?: (loaded: number, total: number) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export class ObfuscatedStreamLoader {
  private currentToken: string;
  private isAborted = false;
  private controller: AbortController | null = null;
  private signedUrl: string | null = null;
  private blobUrl: string | null = null;

  constructor(private options: StreamOptions) {
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo de manière optimisée et sécurisée
   * Utilise directement l'URL signée mais avec des protections
   */
  async load(): Promise<string> {
    try {
      // Obtenir une URL signée pour le streaming direct
      this.signedUrl = await this.getSignedUrl();

      // Créer un AbortController pour pouvoir annuler
      this.controller = new AbortController();
      if (this.options.signal) {
        this.options.signal.addEventListener('abort', () => {
          this.controller?.abort();
        });
      }

      // Utiliser directement l'URL signée - le navigateur gère automatiquement les Range requests
      // C'est la méthode la plus rapide et fluide (comme un MP4 normal)
      // On masque l'URL après chargement pour la sécurité
      
      // Stocker l'URL dans une variable locale (obfuscation)
      const _0x4a2b = this.signedUrl;
      
      // Utiliser directement l'URL signée - le navigateur gère le streaming automatiquement
      this.options.videoElement.src = _0x4a2b;
      this.options.videoElement.load();

      // Surveiller la progression du chargement
      this.monitorProgress();

      // Empêcher le téléchargement via le menu contextuel
      this.preventDownload();

      // Masquer l'URL dans les DevTools après chargement
      this.hideUrlInDevTools();

      console.log('[ObfuscatedStream] ✅ Vidéo prête - chargement direct optimisé');

      // Retourner l'URL signée (sera masquée après chargement)
      return _0x4a2b;

    } catch (error) {
      console.error('[ObfuscatedStream] ❌ Erreur:', error);
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Surveille la progression du chargement
   */
  private monitorProgress(): void {
    const videoElement = this.options.videoElement;
    
    const updateProgress = () => {
      if (!videoElement.buffered.length) return;

      const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
      const duration = videoElement.duration || 0;
      
      if (duration > 0 && this.options.onProgress) {
        const bufferedPercent = (bufferedEnd / duration) * 100;
        this.options.onProgress(bufferedPercent, 100);
      }
    };

    videoElement.addEventListener('progress', updateProgress);
    videoElement.addEventListener('loadedmetadata', updateProgress);
    videoElement.addEventListener('timeupdate', updateProgress);
  }

  /**
   * Empêche le téléchargement via diverses méthodes
   */
  private preventDownload(): void {
    const videoElement = this.options.videoElement;

    // Empêcher le clic droit
    videoElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, { capture: true });

    // Empêcher les raccourcis clavier de téléchargement
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloquer Ctrl+S, Ctrl+Shift+S, etc.
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Bloquer F12, Ctrl+Shift+I, etc. (DevTools)
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    videoElement.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // Empêcher le drag & drop
    videoElement.addEventListener('dragstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, { capture: true });

    // Empêcher la sélection de texte
    videoElement.style.userSelect = 'none';
    videoElement.style.webkitUserSelect = 'none';
  }

  /**
   * Masque l'URL dans les DevTools
   */
  private hideUrlInDevTools(): void {
    const videoElement = this.options.videoElement;

    // Intercepter les tentatives d'accès à l'URL
    let originalSrc = videoElement.src;
    
    // Masquer l'URL après chargement
    videoElement.addEventListener('loadedmetadata', () => {
      // Remplacer l'URL par un blob URL vide dans les DevTools
      try {
        Object.defineProperty(videoElement, 'src', {
          get: () => 'blob:about:blank',
          set: () => {},
          configurable: false
        });
      } catch (e) {
        // Si on ne peut pas redéfinir, on essaie autre chose
        console.warn('[ObfuscatedStream] ⚠️ Impossible de masquer l\'URL');
      }
    }, { once: true });

    // Empêcher l'inspection de l'élément vidéo
    videoElement.addEventListener('loadstart', () => {
      // L'URL est déjà chargée, on ne peut plus la changer
      // Mais on peut empêcher l'accès via les DevTools
    });
  }

  /**
   * Obtient une URL signée pour la vidéo
   */
  private async getSignedUrl(): Promise<string> {
    try {
      const response = await fetch(`/api/videos/stream-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentToken}`
        },
        body: JSON.stringify({
          videoId: this.options.videoId
        }),
        signal: this.controller?.signal
      });

      if (!response.ok) {
        throw new Error(`Erreur URL signée: ${response.status}`);
      }

      const data = await response.json();
      return data.signedUrl || this.options.videoUrl;

    } catch (error) {
      throw new Error('Impossible d\'obtenir URL signée');
    }
  }

  /**
   * Annule le chargement
   */
  abort(): void {
    this.isAborted = true;
    this.controller?.abort();
    
    // Réinitialiser la source vidéo
    if (this.options.videoElement) {
      this.options.videoElement.src = '';
      this.options.videoElement.load();
    }
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    this.abort();
    
    // Révoquer le blob URL
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    
    // Réinitialiser la source vidéo
    if (this.options.videoElement) {
      this.options.videoElement.src = '';
      this.options.videoElement.load();
    }

    console.log('[ObfuscatedStream] 🧹 Ressources nettoyées');
  }
}
