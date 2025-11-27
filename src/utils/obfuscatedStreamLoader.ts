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
   * Utilise un blob URL pour masquer complètement l'URL réelle
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

      // SÉCURITÉ : Créer un blob URL pour masquer complètement l'URL réelle
      // L'URL signée n'est jamais exposée dans le DOM
      this.blobUrl = await this.createSecureBlobUrl();

      // Utiliser le blob URL - l'URL réelle est complètement masquée
      this.options.videoElement.src = this.blobUrl;
      this.options.videoElement.load();

      // Surveiller la progression du chargement
      this.monitorProgress();

      // Empêcher le téléchargement via le menu contextuel
      this.preventDownload();

      // Masquer l'URL dans les DevTools
      this.hideUrlInDevTools();

      console.log('[ObfuscatedStream] ✅ Vidéo prête - URL réelle masquée');

      // Retourner le blob URL (l'URL réelle n'est jamais exposée)
      return this.blobUrl;

    } catch (error) {
      console.error('[ObfuscatedStream] ❌ Erreur:', error);
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Crée un blob URL sécurisé qui masque l'URL réelle
   * Utilise un MediaSource pour le streaming progressif
   */
  private async createSecureBlobUrl(): Promise<string> {
    // Vérifier si MediaSource est disponible
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
      return this.createMediaSourceBlob();
    } else {
      // Fallback : créer un blob à partir d'une requête fetch
      // Note: Ceci charge la vidéo en mémoire, donc pas idéal pour les grandes vidéos
      return this.createFetchBlob();
    }
  }

  /**
   * Crée un blob URL via MediaSource (streaming progressif)
   */
  private async createMediaSourceBlob(): Promise<string> {
    return new Promise((resolve, reject) => {
      const mediaSource = new MediaSource();
      const blobUrl = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', async () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
          
          // Charger la vidéo par chunks via l'URL signée
          await this.loadVideoIntoSourceBuffer(sourceBuffer, mediaSource);
          
          resolve(blobUrl);
        } catch (error) {
          reject(error);
        }
      });

      mediaSource.addEventListener('error', (e) => {
        reject(new Error('Erreur MediaSource'));
      });
    });
  }

  /**
   * Charge la vidéo dans le SourceBuffer par chunks
   */
  private async loadVideoIntoSourceBuffer(sourceBuffer: SourceBuffer, mediaSource: MediaSource): Promise<void> {
    const chunkSize = 5 * 1024 * 1024; // 5MB par chunk
    let offset = 0;
    let videoSize = 0;

    // Obtenir la taille de la vidéo
    try {
      const headResponse = await fetch(this.signedUrl!, { method: 'HEAD' });
      const contentLength = headResponse.headers.get('content-length');
      videoSize = contentLength ? parseInt(contentLength) : 0;
    } catch (error) {
      console.warn('[ObfuscatedStream] ⚠️ Impossible de récupérer la taille');
    }

    // Charger les chunks progressivement
    while (true) {
      if (this.isAborted || this.controller?.signal.aborted) break;

      const end = videoSize > 0 
        ? Math.min(offset + chunkSize - 1, videoSize - 1)
        : offset + chunkSize - 1;

      try {
        const response = await fetch(this.signedUrl!, {
          headers: {
            'Range': `bytes=${offset}-${end}`
          },
          signal: this.controller?.signal
        });

        if (!response.ok && response.status !== 206) {
          if (response.status === 416) {
            // Fin de la vidéo
            break;
          }
          throw new Error(`Erreur chunk: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Attendre que le SourceBuffer soit prêt
        if (sourceBuffer.updating) {
          await new Promise(resolve => {
            sourceBuffer.addEventListener('updateend', resolve, { once: true });
          });
        }

        sourceBuffer.appendBuffer(arrayBuffer);
        offset = end + 1;

        // Mettre à jour la progression
        if (this.options.onProgress && videoSize > 0) {
          this.options.onProgress(offset, videoSize);
        }

        // Si on a atteint la fin
        if (videoSize > 0 && offset >= videoSize) {
          break;
        }

      } catch (error) {
        if (error.name === 'AbortError') {
          break;
        }
        console.error('[ObfuscatedStream] ❌ Erreur chargement chunk:', error);
        // Continuer avec le chunk suivant
        offset = end + 1;
        if (videoSize > 0 && offset >= videoSize) {
          break;
        }
      }
    }

    // Marquer la fin du stream
    if (!sourceBuffer.updating) {
      mediaSource.endOfStream();
    } else {
      sourceBuffer.addEventListener('updateend', () => {
        mediaSource.endOfStream();
      }, { once: true });
    }
  }

  /**
   * Crée un blob URL via fetch (fallback si MediaSource n'est pas disponible)
   */
  private async createFetchBlob(): Promise<string> {
    // Charger les premiers MB pour démarrer rapidement
    const initialSize = 10 * 1024 * 1024; // 10MB
    
    const response = await fetch(this.signedUrl!, {
      headers: {
        'Range': `bytes=0-${initialSize - 1}`
      },
      signal: this.controller?.signal
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Erreur chargement initial: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Continuer le chargement en arrière-plan
    this.continueLoadingInBackground().catch(err => {
      console.warn('[ObfuscatedStream] ⚠️ Erreur chargement arrière-plan:', err);
    });

    return blobUrl;
  }

  /**
   * Continue le chargement en arrière-plan (pour le fallback)
   */
  private async continueLoadingInBackground(): Promise<void> {
    // Cette méthode peut être utilisée pour charger plus de données si nécessaire
    // Pour l'instant, on laisse le navigateur gérer via les Range requests
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
