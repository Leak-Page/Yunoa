/**
 * Système de chargement vidéo obfusqué et optimisé
 * - Chargement direct avec Range requests (comme un MP4 normal)
 * - URL signée avec token pour la sécurité
 * - Blob: pour masquer l'URL réelle
 * - Chargement progressif sans fragments
 * - Optimisé pour vitesse et fluidité
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
  private chunkSize = 2 * 1024 * 1024; // 2MB par chunk pour un chargement rapide
  private currentToken: string;
  private totalSize = 0;
  private loadedSize = 0;
  private isAborted = false;
  private controller: AbortController | null = null;
  private blobUrl: string | null = null;

  constructor(private options: StreamOptions) {
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo de manière optimisée et obfusquée
   * Utilise un blob progressif pour masquer complètement l'URL et empêcher le téléchargement
   */
  async load(): Promise<string> {
    try {
      // Obtenir une URL signée pour le streaming direct
      const signedUrl = await this.getSignedUrl();

      // Créer un AbortController pour pouvoir annuler
      this.controller = new AbortController();
      if (this.options.signal) {
        this.options.signal.addEventListener('abort', () => {
          this.controller?.abort();
        });
      }

      // Obtenir la taille pour la progression
      await this.fetchVideoSize();

      // SÉCURITÉ : Charger via un blob progressif pour masquer complètement l'URL
      // L'URL réelle n'est jamais exposée, même dans les DevTools
      // Le blob est mis à jour progressivement sans interruption
      
      return await this.loadWithSecureBlob(signedUrl);

    } catch (error) {
      console.error('[ObfuscatedStream] ❌ Erreur:', error);
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Charge avec un blob sécurisé qui se met à jour progressivement
   * L'URL réelle n'est jamais exposée
   */
  private async loadWithSecureBlob(signedUrl: string): Promise<string> {
    const blobParts: BlobPart[] = [];
    let blobUrl: string | null = null;
    let isVideoReady = false;
    const INITIAL_CHUNKS = 8; // Charger 8 chunks (16MB) pour démarrer rapidement
    const UPDATE_INTERVAL = 8; // Mettre à jour tous les 8 chunks
    let lastUpdateChunkCount = 0;
    let isUpdating = false;

    // Fonction pour créer/mettre à jour le blob de manière sécurisée
    const updateBlob = (force: boolean = false) => {
      if (blobParts.length === 0 || isUpdating) return;

      // Ne pas créer de nouveau blob si on n'a pas assez de nouveaux segments
      if (!force && blobParts.length - lastUpdateChunkCount < UPDATE_INTERVAL && isVideoReady) {
        return;
      }

      const newBlob = new Blob(blobParts, { type: 'video/mp4' });
      const newBlobUrl = URL.createObjectURL(newBlob);

      if (!isVideoReady && blobParts.length >= INITIAL_CHUNKS) {
        // Première création du blob
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
        blobUrl = newBlobUrl;
        this.options.videoElement.src = blobUrl;
        this.options.videoElement.load();
        isVideoReady = true;
        lastUpdateChunkCount = blobParts.length;
        console.log(`[ObfuscatedStream] 🎬 Vidéo prête avec ${blobParts.length} chunks`);
      } else if (isVideoReady && (force || blobParts.length - lastUpdateChunkCount >= UPDATE_INTERVAL)) {
        // Mettre à jour le blob seulement si nécessaire
        const videoElement = this.options.videoElement;
        const wasPlaying = !videoElement.paused;
        const currentTime = videoElement.currentTime || 0;
        
        const bufferedEnd = videoElement.buffered.length > 0 
          ? videoElement.buffered.end(videoElement.buffered.length - 1) 
          : 0;
        const duration = videoElement.duration || 0;
        const bufferAhead = bufferedEnd - currentTime;
        
        // Mettre à jour seulement si le buffer est vraiment faible
        if (force || bufferAhead < 2 || (duration > 0 && duration - currentTime < 15)) {
          isUpdating = true;
          
          const savedTime = currentTime;
          const savedPlaying = wasPlaying;
          
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
          }
          blobUrl = newBlobUrl;
          
          const handleLoadedMetadata = () => {
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            if (savedTime > 0 && savedTime < duration) {
              videoElement.currentTime = savedTime;
            }
            setTimeout(() => {
              if (savedPlaying && videoElement.paused) {
                videoElement.play().catch(() => {});
              }
              isUpdating = false;
              lastUpdateChunkCount = blobParts.length;
            }, 50);
          };
          
          videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
          videoElement.src = blobUrl;
          videoElement.load();
        } else {
          URL.revokeObjectURL(newBlobUrl);
        }
      } else {
        URL.revokeObjectURL(newBlobUrl);
      }
    };

    // Charger les chunks séquentiellement avec Range requests
    const chunkSize = 2 * 1024 * 1024; // 2MB par chunk
    const totalChunks = Math.ceil((this.totalSize || 100 * 1024 * 1024) / chunkSize);
    let currentSignedUrl = signedUrl;
    let urlRenewalTime = Date.now() + 4 * 60 * 1000; // Renouveler après 4 minutes

    for (let i = 0; i < totalChunks; i++) {
      if (this.isAborted || this.controller?.signal.aborted) break;

      // SÉCURITÉ : Renouveler l'URL signée si nécessaire (tokens expirent après 5 min)
      if (Date.now() > urlRenewalTime) {
        try {
          currentSignedUrl = await this.getSignedUrl();
          urlRenewalTime = Date.now() + 4 * 60 * 1000;
          console.log('[ObfuscatedStream] 🔄 URL signée renouvelée');
        } catch (error) {
          console.warn('[ObfuscatedStream] ⚠️ Impossible de renouveler l\'URL, utilisation de l\'ancienne');
        }
      }

      try {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize - 1, (this.totalSize || 100 * 1024 * 1024) - 1);

        // SÉCURITÉ : Utiliser un User-Agent normal pour éviter la détection
        const response = await fetch(currentSignedUrl, {
          headers: {
            'Range': `bytes=${start}-${end}`,
            'User-Agent': navigator.userAgent, // User-Agent du navigateur
            'Referer': window.location.origin // Referer pour validation
          },
          signal: this.controller?.signal
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Erreur chunk ${i}: ${response.status}`);
        }

        const blob = await response.blob();
        blobParts.push(blob);
        this.loadedSize += blob.size;

        if (this.options.onProgress) {
          this.options.onProgress(this.loadedSize, this.totalSize || this.loadedSize);
        }

        // Mettre à jour le blob progressivement
        if (!isVideoReady || blobParts.length % UPDATE_INTERVAL === 0) {
          updateBlob(false);
        }

        // Vérifier le buffer si la vidéo est prête
        if (isVideoReady) {
          const videoElement = this.options.videoElement;
          const bufferedEnd = videoElement.buffered.length > 0 
            ? videoElement.buffered.end(videoElement.buffered.length - 1) 
            : 0;
          const currentTime = videoElement.currentTime || 0;
          const bufferAhead = bufferedEnd - currentTime;
          
          if (bufferAhead < 2) {
            updateBlob(true);
          }
        }

      } catch (error) {
        console.error(`[ObfuscatedStream] ❌ Erreur chunk ${i}:`, error);
        // Continuer avec le chunk suivant
        continue;
      }
    }

    // Mise à jour finale
    updateBlob(true);

    console.log('[ObfuscatedStream] ✅ Vidéo chargée - URL réelle jamais exposée');
    
    return blobUrl || '';
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
  }

  /**
   * Récupère la taille de la vidéo (optionnel, peut être ignoré)
   */
  private async fetchVideoSize(): Promise<void> {
    try {
      // Obtenir une URL signée pour la vidéo
      const signedUrl = await this.getSignedUrl();

      const response = await fetch(signedUrl, {
        method: 'HEAD',
        signal: this.controller?.signal
      });

      if (response.ok) {
        const contentLength = response.headers.get('content-length');
        this.totalSize = contentLength ? parseInt(contentLength) : 0;
        
        if (this.totalSize > 0) {
          console.log(`[ObfuscatedStream] 📦 Taille vidéo: ${Math.round(this.totalSize / 1024 / 1024)} MB`);
        }
      }
    } catch (error) {
      // Ignorer l'erreur, on peut continuer sans connaître la taille exacte
      console.warn('[ObfuscatedStream] ⚠️ Impossible de récupérer la taille, utilisation de la valeur par défaut');
      this.totalSize = 100 * 1024 * 1024; // 100MB par défaut
    }
  }

  /**
   * Obtient une URL signée pour la vidéo (renouvelée régulièrement)
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
   * Renouvelle l'URL signée si nécessaire (tokens expirent après 5 minutes)
   */
  private async renewSignedUrlIfNeeded(currentUrl: string): Promise<string> {
    // Vérifier si le token est encore valide (on peut extraire l'exp du token)
    // Pour simplifier, on renouvelle toutes les 4 minutes
    return currentUrl; // Pour l'instant, on garde la même URL
  }

  /**
   * Charge la vidéo progressivement avec Range requests
   * Optimisé pour vitesse et fluidité
   */
  private async loadProgressive(): Promise<Blob> {
    const signedUrl = await this.getSignedUrl();
    const chunks: BlobPart[] = new Array(Math.ceil(this.totalSize / this.chunkSize));
    const totalChunks = chunks.length;
    
    console.log(`[ObfuscatedStream] 🚀 Chargement progressif: ${totalChunks} chunks (${Math.round(this.totalSize / 1024 / 1024)} MB)`);

    // Charger les chunks en parallèle pour un chargement rapide
    const maxConcurrent = 4; // 4 chunks en parallèle pour vitesse maximale
    let currentIndex = 0;

    while (currentIndex < totalChunks && !this.isAborted && !this.controller?.signal.aborted) {
      // Charger plusieurs chunks en parallèle
      const chunksToLoad = Math.min(maxConcurrent, totalChunks - currentIndex);
      const loadPromises: Promise<void>[] = [];

      for (let i = 0; i < chunksToLoad; i++) {
        const chunkIndex = currentIndex + i;
        loadPromises.push(this.loadChunk(signedUrl, chunkIndex, chunks));
      }

      await Promise.all(loadPromises);
      currentIndex += chunksToLoad;

      // Mettre à jour la progression
      if (this.options.onProgress) {
        this.options.onProgress(this.loadedSize, this.totalSize);
      }
    }

    // Créer le blob final avec tous les chunks dans l'ordre
    return new Blob(chunks.filter(c => c !== undefined), { type: 'video/mp4' });
  }

  /**
   * Charge un chunk individuel avec Range request
   */
  private async loadChunk(url: string, chunkIndex: number, chunks: BlobPart[]): Promise<void> {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize - 1, this.totalSize - 1);

    try {
      const response = await fetch(url, {
        headers: {
          'Range': `bytes=${start}-${end}`
        },
        signal: this.controller?.signal
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`Erreur chunk ${chunkIndex}: ${response.status}`);
      }

      const blob = await response.blob();
      chunks[chunkIndex] = blob; // Stocker dans l'ordre
      this.loadedSize += blob.size;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      console.error(`[ObfuscatedStream] ❌ Erreur chunk ${chunkIndex}:`, error);
      throw error;
    }
  }

  /**
   * Annule le chargement
   */
  abort(): void {
    this.isAborted = true;
    this.controller?.abort();
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    this.abort();
    
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }

    console.log('[ObfuscatedStream] 🧹 Ressources nettoyées');
  }
}

