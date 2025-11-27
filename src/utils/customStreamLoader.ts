/**
 * Système de streaming vidéo personnalisé et complet
 * Architecture custom : MP4 → chunks sécurisés → MSE → lecture fluide
 * Pas de dépendances externes, tout est custom
 */

interface CustomStreamOptions {
  videoUrl: string;
  videoId: string;
  sessionToken: string;
  videoElement: HTMLVideoElement;
  onProgress?: (loaded: number, total: number) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

interface VideoChunk {
  index: number;
  start: number;
  end: number;
  data: ArrayBuffer;
  loaded: boolean;
}

export class CustomStreamLoader {
  private videoElement: HTMLVideoElement;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private chunks: Map<number, VideoChunk> = new Map();
  private loadedChunks: Set<number> = new Set();
  private isAborted = false;
  private isInitialized = false;
  private videoMetadata: {
    duration: number;
    totalSize: number;
    chunkSize: number;
    totalChunks: number;
  } | null = null;
  private currentChunkIndex = 0;
  private bufferingStrategy: 'aggressive' | 'balanced' | 'conservative' = 'balanced';
  private maxConcurrentRequests = 3;
  private activeRequests = 0;
  private requestQueue: number[] = [];

  constructor(private options: CustomStreamOptions) {
    this.videoElement = options.videoElement;
    this.setupProtections();
  }

  /**
   * Initialise et charge la vidéo avec le système custom
   */
  async load(): Promise<string> {
    try {
      console.log('[CustomStream] 🚀 Initialisation du système de streaming personnalisé');

      // Étape 1: Obtenir les métadonnées de la vidéo
      await this.fetchMetadata();

      // Étape 2: Initialiser MediaSource
      try {
        await this.initializeMediaSource();
      } catch (mseError) {
        console.warn('[CustomStream] ⚠️ MediaSource non disponible, utilisation du fallback');
        throw new Error('MediaSource non supporté');
      }

      // Étape 3: Charger les chunks initiaux
      try {
        await this.loadInitialChunks();
      } catch (chunkError) {
        console.warn('[CustomStream] ⚠️ Erreur lors du chargement des chunks, MediaSource ne peut pas utiliser des MP4 bruts');
        throw new Error('Chunks MP4 bruts non compatibles avec MediaSource');
      }

      // Étape 4: Démarrer le chargement progressif
      this.startProgressiveLoading();

      return 'blob:custom-stream';
    } catch (error) {
      console.error('[CustomStream] ❌ Erreur:', error);
      // Nettoyer MediaSource si initialisé
      this.cleanup();
      // Propager l'erreur pour que SecureChunkLoader utilise le fallback
      throw error;
    }
  }

  /**
   * Récupère les métadonnées de la vidéo
   */
  private async fetchMetadata(): Promise<void> {
    const response = await fetch('/api/videos/stream-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.sessionToken}`
      },
      body: JSON.stringify({
        videoId: this.options.videoId
      }),
      signal: this.options.signal
    });

    if (!response.ok) {
      throw new Error(`Erreur métadonnées: ${response.status}`);
    }

    const data = await response.json();
    this.videoMetadata = {
      duration: data.duration || 0,
      totalSize: data.totalSize || 0,
      chunkSize: data.chunkSize || 2 * 1024 * 1024, // 2MB par défaut
      totalChunks: data.totalChunks || 0
    };

    console.log('[CustomStream] 📊 Métadonnées:', this.videoMetadata);
  }

  /**
   * Initialise MediaSource avec le codec approprié
   */
  private async initializeMediaSource(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Détecter le codec supporté
        const codec = this.detectCodec();
        
        this.mediaSource = new MediaSource();
        const url = URL.createObjectURL(this.mediaSource);
        this.videoElement.src = url;

        this.mediaSource.addEventListener('sourceopen', () => {
          try {
            console.log('[CustomStream] 🔓 MediaSource ouvert, ajout du SourceBuffer...');
            this.sourceBuffer = this.mediaSource!.addSourceBuffer(codec);
            this.sourceBuffer.mode = 'sequence';
            
            // Le SourceBuffer est prêt immédiatement après création
            if (!this.isInitialized) {
              this.isInitialized = true;
              console.log('[CustomStream] ✅ MediaSource initialisé');
              resolve();
            }
            
            this.sourceBuffer.addEventListener('updateend', () => {
              console.log('[CustomStream] 📝 SourceBuffer mis à jour');
            });

      this.sourceBuffer.addEventListener('error', (e) => {
        console.error('[CustomStream] ❌ Erreur SourceBuffer:', e);
        // MediaSource ne peut pas utiliser des chunks MP4 bruts
        // Il faut des fragments MP4 (fMP4) préparés
        reject(new Error('MediaSource ne peut pas utiliser des chunks MP4 bruts - nécessite des fragments MP4 (fMP4)'));
      });
          } catch (error) {
            console.error('[CustomStream] ❌ Erreur lors de l\'ajout du SourceBuffer:', error);
            reject(error);
          }
        }, { once: true });

        this.mediaSource.addEventListener('error', (e) => {
          console.error('[CustomStream] ❌ Erreur MediaSource:', e);
          reject(new Error('Erreur MediaSource'));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Détecte le codec vidéo supporté
   */
  private detectCodec(): string {
    // Essayer les codecs courants dans l'ordre de préférence
    const codecs = [
      'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // H.264 + AAC
      'video/mp4; codecs="avc1.42E01E"', // H.264 seulement
      'video/mp4; codecs="mp4a.40.2"', // AAC seulement
      'video/mp4' // Fallback
    ];

    for (const codec of codecs) {
      if (MediaSource.isTypeSupported(codec)) {
        console.log('[CustomStream] 🎬 Codec détecté:', codec);
        return codec;
      }
    }

    // Fallback sur le codec le plus basique
    return 'video/mp4';
  }

  /**
   * Charge les chunks initiaux pour démarrer la lecture
   */
  private async loadInitialChunks(): Promise<void> {
    const initialChunks = this.getInitialChunkIndices();
    console.log('[CustomStream] 📦 Chargement des chunks initiaux:', initialChunks);

    // Charger le premier chunk d'abord (séquentiel pour MediaSource)
    for (const index of initialChunks) {
      await this.loadChunk(index);
    }
  }

  /**
   * Détermine quels chunks charger en premier
   */
  private getInitialChunkIndices(): number[] {
    const count = Math.min(5, this.videoMetadata!.totalChunks);
    return Array.from({ length: count }, (_, i) => i);
  }

  /**
   * Charge un chunk spécifique
   */
  private async loadChunk(index: number): Promise<void> {
    if (this.loadedChunks.has(index) || this.isAborted) {
      return;
    }

    // Gérer la file d'attente si trop de requêtes simultanées
    if (this.activeRequests >= this.maxConcurrentRequests) {
      this.requestQueue.push(index);
      return;
    }

    this.activeRequests++;
    this.loadedChunks.add(index);

    try {
      console.log(`[CustomStream] 📥 Chargement du chunk ${index}...`);
      const chunk = await this.fetchChunk(index);
      console.log(`[CustomStream] ✅ Chunk ${index} chargé (${chunk.data.byteLength} bytes)`);
      this.chunks.set(index, chunk);
      
      // Ajouter le chunk au SourceBuffer si c'est le prochain attendu
      if (index === this.currentChunkIndex) {
        console.log(`[CustomStream] ➕ Ajout du chunk ${index} au SourceBuffer...`);
        try {
          await this.appendChunkToBuffer(chunk);
          this.currentChunkIndex++;
          
          // Charger le chunk suivant
          this.loadNextChunk();
        } catch (bufferError) {
          // MediaSource ne peut pas utiliser des chunks MP4 bruts
          console.error(`[CustomStream] ❌ Impossible d'ajouter le chunk ${index} au buffer:`, bufferError);
          throw bufferError; // Propager l'erreur pour déclencher le fallback
        }
      } else {
        console.log(`[CustomStream] ⏳ Chunk ${index} chargé mais pas encore ajouté (attendu: ${this.currentChunkIndex})`);
      }
    } catch (error) {
      console.error(`[CustomStream] ❌ Erreur chunk ${index}:`, error);
      this.loadedChunks.delete(index);
      this.options.onError?.(error as Error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Récupère un chunk depuis l'API
   */
  private async fetchChunk(index: number): Promise<VideoChunk> {
    const chunkSize = this.videoMetadata!.chunkSize;
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize - 1, this.videoMetadata!.totalSize - 1);

    const response = await fetch('/api/videos/stream-chunk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.sessionToken}`
      },
      body: JSON.stringify({
        videoId: this.options.videoId,
        chunkIndex: index,
        start,
        end
      }),
      signal: this.options.signal
    });

    if (!response.ok) {
      throw new Error(`Erreur chunk ${index}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      index,
      start,
      end,
      data: arrayBuffer,
      loaded: true
    };
  }

  /**
   * Ajoute un chunk au SourceBuffer
   */
  private async appendChunkToBuffer(chunk: VideoChunk): Promise<void> {
    if (!this.sourceBuffer || this.isAborted) {
      console.warn('[CustomStream] ⚠️ SourceBuffer non disponible ou aborted');
      return;
    }

    return new Promise((resolve, reject) => {
      if (this.sourceBuffer!.updating) {
        console.log('[CustomStream] ⏳ SourceBuffer en cours de mise à jour, attente...');
        this.sourceBuffer!.addEventListener('updateend', () => {
          this.appendChunkToBuffer(chunk).then(resolve).catch(reject);
        }, { once: true });
        return;
      }

      try {
        console.log(`[CustomStream] 📤 Ajout de ${chunk.data.byteLength} bytes au SourceBuffer...`);
        this.sourceBuffer!.appendBuffer(chunk.data);
        
        this.sourceBuffer!.addEventListener('updateend', () => {
          console.log(`[CustomStream] ✅ Chunk ${chunk.index} ajouté au buffer`);
          // Mettre à jour la progression
          if (this.options.onProgress && this.videoMetadata) {
            const loaded = (this.currentChunkIndex / this.videoMetadata.totalChunks) * 100;
            this.options.onProgress(loaded, 100);
          }
          resolve();
        }, { once: true });
        
        this.sourceBuffer!.addEventListener('error', (e) => {
          console.error('[CustomStream] ❌ Erreur lors de l\'ajout au buffer:', e);
          // MediaSource ne peut pas utiliser des chunks MP4 bruts
          reject(new Error('MediaSource ne peut pas utiliser des chunks MP4 bruts - nécessite des fragments MP4 (fMP4)'));
        }, { once: true });
      } catch (error) {
        console.error('[CustomStream] ❌ Exception lors de appendBuffer:', error);
        reject(error);
      }
    });
  }

  /**
   * Charge le chunk suivant
   */
  private loadNextChunk(): void {
    if (this.currentChunkIndex < this.videoMetadata!.totalChunks) {
      this.loadChunk(this.currentChunkIndex);
    }
  }

  /**
   * Traite la file d'attente des requêtes
   */
  private processQueue(): void {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const index = this.requestQueue.shift()!;
      this.loadChunk(index);
    }
  }

  /**
   * Démarre le chargement progressif basé sur la position de lecture
   */
  private startProgressiveLoading(): void {
    this.videoElement.addEventListener('timeupdate', () => {
      if (this.isAborted) return;

      const currentTime = this.videoElement.currentTime;
      const duration = this.videoElement.duration || this.videoMetadata!.duration;
      const progress = currentTime / duration;
      
      // Calculer quels chunks sont nécessaires
      const requiredChunkIndex = Math.floor(progress * this.videoMetadata!.totalChunks);
      
      // Précharger les chunks à venir
      const lookAhead = this.bufferingStrategy === 'aggressive' ? 10 : 
                       this.bufferingStrategy === 'balanced' ? 5 : 3;
      
      for (let i = 0; i < lookAhead; i++) {
        const chunkIndex = requiredChunkIndex + i;
        if (chunkIndex < this.videoMetadata!.totalChunks && !this.loadedChunks.has(chunkIndex)) {
          this.loadChunk(chunkIndex);
        }
      }
    });

    // Surveiller le buffering
    this.videoElement.addEventListener('waiting', () => {
      console.log('[CustomStream] ⏳ Buffering...');
      // Charger plus de chunks si on manque de buffer
      this.loadChunk(this.currentChunkIndex);
    });

    this.videoElement.addEventListener('canplay', () => {
      console.log('[CustomStream] ▶️ Prêt à jouer');
    });
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
  }

  /**
   * Annule le chargement
   */
  abort(): void {
    this.isAborted = true;
    this.chunks.clear();
    this.loadedChunks.clear();
    this.requestQueue = [];
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    this.abort();

    if (this.sourceBuffer) {
      try {
        if (this.sourceBuffer.updating) {
          this.sourceBuffer.abort();
        }
        if (this.mediaSource && this.mediaSource.readyState === 'open') {
          this.mediaSource.removeSourceBuffer(this.sourceBuffer);
        }
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
      this.sourceBuffer = null;
    }

    if (this.mediaSource) {
      try {
        if (this.mediaSource.readyState === 'open') {
          this.mediaSource.endOfStream();
        }
        URL.revokeObjectURL(this.videoElement.src);
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
      this.mediaSource = null;
    }

    if (this.videoElement) {
      this.videoElement.src = '';
      this.videoElement.load();
    }

    console.log('[CustomStream] 🧹 Ressources nettoyées');
  }
}

