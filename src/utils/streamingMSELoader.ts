import { clientFingerprint } from './clientFingerprint';

/**
 * Système de streaming par segments avec Media Source Extensions (MSE)
 * - Chargement rapide par segments en parallèle
 * - URL signées (tokens) pour la sécurité
 * - Blob: pour masquer les URLs réelles
 * - Chiffrement AES léger optionnel
 * - Compatible avec tous les navigateurs modernes
 */

interface SegmentRequest {
  videoId: string;
  chunkIndex: number;
  timestamp: number;
  fingerprint: string;
  previousHash?: string;
  sessionId?: string;
}

interface SegmentResponse {
  data: ArrayBuffer;
  nextHash: string;
  nextToken: string;
  expiresAt: number;
}

interface StreamingLoaderOptions {
  videoUrl: string;
  videoId: string;
  sessionToken: string;
  videoElement: HTMLVideoElement;
  onProgress?: (loaded: number, total: number) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
  chunkSize?: number; // Taille des segments en bytes (défaut: 1MB pour un chargement rapide)
}

export class StreamingMSELoader {
  private chunkSize: number;
  private currentToken: string;
  private fingerprint: string | null = null;
  private lastHash: string | null = null;
  private sessionId: string | null = null;
  private isAborted = false;
  
  // Media Source Extensions
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private isAppending = false;
  private segmentQueue: ArrayBuffer[] = [];
  private totalSize = 0;
  private totalChunks = 0;
  private loadedChunks = 0;
  private codec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
  
  // Chargement parallèle
  private maxConcurrentRequests = 3; // Charger 3 segments en parallèle
  private loadingChunks = new Set<number>();
  private loadedSegments = new Map<number, ArrayBuffer>();
  private nextChunkToAppend = 0;

  constructor(private options: StreamingLoaderOptions) {
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB par défaut pour un chargement rapide
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo en streaming avec MSE
   */
  async load(): Promise<string> {
    // Générer l'empreinte du client
    this.fingerprint = await clientFingerprint.generate();
    if (!this.fingerprint) {
      throw new Error('Impossible de générer l\'empreinte du client');
    }

    // Obtenir les métadonnées
    const metadata = await this.fetchMetadata();
    this.totalSize = metadata.size;
    this.totalChunks = Math.ceil(metadata.size / this.chunkSize);
    
    if (metadata.sessionId) {
      this.sessionId = metadata.sessionId;
    }
    
    if (metadata.initialToken) {
      this.currentToken = metadata.initialToken;
    }

    console.log(`[StreamingMSE] 🚀 Démarrage streaming: ${this.totalChunks} segments (${Math.round(metadata.size / 1024 / 1024)} MB)`);

    // Vérifier le support MSE
    if (!window.MediaSource || !MediaSource.isTypeSupported(this.codec)) {
      // Essayer d'autres codecs
      const codecs = [
        'video/mp4; codecs="avc1.4D001E, mp4a.40.2"',
        'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
        'video/mp4'
      ];
      
      for (const c of codecs) {
        if (MediaSource.isTypeSupported(c)) {
          this.codec = c;
          break;
        }
      }
      
      if (!MediaSource.isTypeSupported(this.codec)) {
        throw new Error('Media Source Extensions non supporté par votre navigateur');
      }
    }

    // Créer MediaSource
    this.mediaSource = new MediaSource();
    const blobUrl = URL.createObjectURL(this.mediaSource);
    
    // Configurer l'élément vidéo
    this.options.videoElement.src = blobUrl;
    this.options.videoElement.addEventListener('error', (e) => {
      console.error('[StreamingMSE] ❌ Erreur vidéo:', e);
      this.options.onError?.(new Error('Erreur de lecture vidéo'));
    });

    // Attendre que MediaSource soit ouvert
    return new Promise((resolve, reject) => {
      this.mediaSource!.addEventListener('sourceopen', () => {
        this.initializeSourceBuffer()
          .then(() => {
            // Démarrer le chargement des segments
            this.startLoading();
            resolve(blobUrl);
          })
          .catch(reject);
      }, { once: true });

      this.mediaSource!.addEventListener('error', (e) => {
        console.error('[StreamingMSE] ❌ Erreur MediaSource:', e);
        reject(new Error('Erreur MediaSource'));
      }, { once: true });
    });
  }

  /**
   * Initialise le SourceBuffer
   */
  private async initializeSourceBuffer(): Promise<void> {
    if (!this.mediaSource || this.mediaSource.readyState !== 'open') {
      throw new Error('MediaSource n\'est pas ouvert');
    }

    try {
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.codec);
      console.log(`[StreamingMSE] ✅ SourceBuffer créé avec codec: ${this.codec}`);
      
      // Gérer les événements du SourceBuffer
      this.sourceBuffer.addEventListener('updateend', () => {
        this.isAppending = false;
        console.log(`[StreamingMSE] 📊 updateend - Prochain segment à ajouter: ${this.nextChunkToAppend}`);
        // Traiter la file d'attente pour ajouter le prochain segment
        this.processSegmentQueue();
      });

      this.sourceBuffer.addEventListener('update', () => {
        // Événement déclenché pendant l'ajout
        console.log('[StreamingMSE] 📊 update - Segment en cours d\'ajout');
      });

      this.sourceBuffer.addEventListener('error', (e) => {
        console.error('[StreamingMSE] ❌ Erreur SourceBuffer:', e);
        this.isAppending = false;
        this.options.onError?.(new Error('Erreur SourceBuffer'));
      });

      this.sourceBuffer.addEventListener('abort', () => {
        console.warn('[StreamingMSE] ⚠️ SourceBuffer abort');
        this.isAppending = false;
      });

    } catch (error) {
      throw new Error(`Impossible de créer SourceBuffer: ${error}`);
    }
  }

  /**
   * Démarre le chargement des segments séquentiellement
   * IMPORTANT: Le serveur exige un chargement séquentiel (0, 1, 2, 3...)
   * On ne peut pas charger en parallèle car cela casse la séquence
   */
  private async startLoading(): Promise<void> {
    // Charger les premiers segments séquentiellement pour démarrer la lecture
    const initialSegments = Math.min(5, this.totalChunks);
    
    console.log(`[StreamingMSE] 📦 Chargement séquentiel des ${initialSegments} premiers segments...`);
    
    // Charger les segments initiaux SÉQUENTIELLEMENT (pas en parallèle)
    for (let i = 0; i < initialSegments; i++) {
      await this.loadSegment(i);
      // Traiter la file d'attente après chaque segment pour les ajouter au SourceBuffer
      this.processSegmentQueue();
    }
    
    console.log(`[StreamingMSE] ✅ ${initialSegments} segments initiaux chargés`);
    
    // Continuer le chargement en arrière-plan
    this.continueLoading();
  }

  /**
   * Continue le chargement des segments restants
   * IMPORTANT: Chargement SÉQUENTIEL pour respecter la séquence du serveur
   */
  private async continueLoading(): Promise<void> {
    // Trouver le prochain segment à charger (séquentiellement)
    let nextChunkToLoad = 0;
    
    while (nextChunkToLoad < this.totalChunks && !this.isAborted && !this.options.signal?.aborted) {
      // Trouver le prochain segment non chargé (dans l'ordre)
      while (nextChunkToLoad < this.totalChunks && 
             (this.loadedSegments.has(nextChunkToLoad) || this.loadingChunks.has(nextChunkToLoad))) {
        nextChunkToLoad++;
      }

      // Si tous les segments sont chargés ou en cours, sortir
      if (nextChunkToLoad >= this.totalChunks) {
        break;
      }

      // Charger le segment SÉQUENTIELLEMENT
      await this.loadSegment(nextChunkToLoad);
      
      // Traiter la file d'attente pour ajouter les segments au SourceBuffer
      this.processSegmentQueue();

      // Vérifier si on doit charger plus de segments
      const bufferAhead = this.getBufferAhead();
      if (bufferAhead > 30) {
        // Buffer suffisant, attendre un peu avant de charger le prochain
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // Buffer faible, continuer rapidement
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      nextChunkToLoad++;
    }

    // Tous les segments sont chargés, fermer MediaSource
    if (this.loadedChunks === this.totalChunks && this.mediaSource && this.mediaSource.readyState === 'open') {
      // Attendre que tous les segments soient ajoutés au SourceBuffer
      while (this.nextChunkToAppend < this.totalChunks) {
        this.processSegmentQueue();
        if (this.nextChunkToAppend < this.totalChunks) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      try {
        this.mediaSource.endOfStream();
        console.log('[StreamingMSE] ✅ Tous les segments chargés et ajoutés');
      } catch (e) {
        console.warn('[StreamingMSE] ⚠️ Impossible de fermer MediaSource:', e);
      }
    }
  }

  /**
   * Charge un segment individuel
   */
  private async loadSegment(chunkIndex: number): Promise<void> {
    if (this.isAborted || this.options.signal?.aborted || this.loadedSegments.has(chunkIndex)) {
      return;
    }

    this.loadingChunks.add(chunkIndex);

    try {
      const segment = await this.fetchSegment(chunkIndex);
      
      // Stocker le segment
      this.loadedSegments.set(chunkIndex, segment.data);
      this.loadedChunks++;
      
      // Mettre à jour le token et le hash
      this.currentToken = segment.nextToken;
      this.lastHash = segment.nextHash;

      // Mettre à jour la progression
      if (this.options.onProgress) {
        const loaded = this.loadedChunks * this.chunkSize;
        this.options.onProgress(Math.min(loaded, this.totalSize), this.totalSize);
      }

      // Essayer d'ajouter le segment au SourceBuffer
      this.processSegmentQueue();

    } catch (error) {
      console.error(`[StreamingMSE] ❌ Erreur segment ${chunkIndex}:`, error);
      // Réessayer après un délai
      setTimeout(() => {
        this.loadingChunks.delete(chunkIndex);
        if (!this.isAborted) {
          this.loadSegment(chunkIndex).catch(() => {});
        }
      }, 1000);
      return;
    } finally {
      this.loadingChunks.delete(chunkIndex);
    }
  }

  /**
   * Traite la file d'attente des segments pour les ajouter au SourceBuffer
   */
  private processSegmentQueue(): void {
    if (!this.sourceBuffer || this.mediaSource?.readyState !== 'open') {
      if (!this.sourceBuffer) {
        console.warn('[StreamingMSE] ⚠️ SourceBuffer non disponible');
      }
      if (this.mediaSource?.readyState !== 'open') {
        console.warn(`[StreamingMSE] ⚠️ MediaSource state: ${this.mediaSource?.readyState}`);
      }
      return;
    }

    // Si on est en train d'ajouter, attendre
    if (this.isAppending || this.sourceBuffer.updating) {
      return;
    }

    // Chercher le prochain segment à ajouter (dans l'ordre)
    while (this.loadedSegments.has(this.nextChunkToAppend)) {
      const segment = this.loadedSegments.get(this.nextChunkToAppend);
      if (!segment) {
        this.loadedSegments.delete(this.nextChunkToAppend);
        this.nextChunkToAppend++;
        continue;
      }

      try {
        // Vérifier si le SourceBuffer a de l'espace
        if (this.sourceBuffer.updating) {
          return; // Attendre que l'ajout précédent se termine
        }

        // Ajouter le segment
        this.sourceBuffer.appendBuffer(segment);
        this.isAppending = true;
        this.loadedSegments.delete(this.nextChunkToAppend);
        const addedChunk = this.nextChunkToAppend;
        this.nextChunkToAppend++;

        console.log(`[StreamingMSE] ✅ Segment ${addedChunk}/${this.totalChunks} ajouté au SourceBuffer`);

        // Sortir de la boucle car on attend l'événement updateend
        return;

      } catch (error) {
        console.error(`[StreamingMSE] ❌ Erreur ajout segment ${this.nextChunkToAppend}:`, error);
        // Retirer le segment problématique et continuer
        this.loadedSegments.delete(this.nextChunkToAppend);
        this.nextChunkToAppend++;
        // Réessayer plus tard
        break;
      }
    }
  }

  /**
   * Calcule le buffer en avance (en secondes)
   */
  private getBufferAhead(): number {
    const video = this.options.videoElement;
    if (!video || !video.buffered.length) return 0;

    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const currentTime = video.currentTime || 0;
    return bufferedEnd - currentTime;
  }

  /**
   * Récupère les métadonnées de la vidéo
   */
  private async fetchMetadata(): Promise<{ size: number; contentType: string; sessionId?: string; initialToken?: string }> {
    const response = await fetch(`/api/videos/secure-stream/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`
      },
      body: JSON.stringify({
        videoId: this.options.videoId,
        fingerprint: this.fingerprint
      }),
      signal: this.options.signal
    });

    if (!response.ok) {
      throw new Error(`Erreur métadonnées: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Récupère un segment avec validation
   */
  private async fetchSegment(chunkIndex: number): Promise<SegmentResponse> {
    const request: SegmentRequest = {
      videoId: this.options.videoId,
      chunkIndex,
      timestamp: Date.now(),
      fingerprint: this.fingerprint!,
      encrypted: false
    };

    if (this.sessionId) {
      request.sessionId = this.sessionId;
    }

    if (chunkIndex > 0 && this.lastHash) {
      request.previousHash = this.lastHash;
    }

    const response = await fetch(`/api/videos/secure-stream/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`,
        'X-Chunk-Index': chunkIndex.toString(),
        'X-Total-Chunks': this.totalChunks.toString(),
        'X-Chunk-Size': this.chunkSize.toString() // Envoyer la taille de chunk souhaitée
      },
      body: JSON.stringify(request),
      signal: this.options.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur segment ${chunkIndex}: ${response.status} - ${errorText}`);
    }

    // Récupérer les headers de validation
    const nextToken = response.headers.get('X-Next-Token');
    const nextHash = response.headers.get('X-Next-Hash');
    const expiresAt = parseInt(response.headers.get('X-Expires-At') || '0');

    if (!nextToken || !nextHash) {
      throw new Error('Réponse invalide du serveur');
    }

    const data = await response.arrayBuffer();

    return {
      data,
      nextToken,
      nextHash,
      expiresAt
    };
  }

  /**
   * Annule le chargement
   */
  abort(): void {
    this.isAborted = true;
    this.loadingChunks.clear();
    this.loadedSegments.clear();
    
    if (this.sourceBuffer && this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        if (this.sourceBuffer.updating) {
          this.sourceBuffer.abort();
        }
      } catch (e) {
        // Ignorer les erreurs lors de l'annulation
      }
    }
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    this.abort();
    
    if (this.mediaSource) {
      try {
        if (this.mediaSource.readyState === 'open') {
          this.mediaSource.endOfStream();
        }
      } catch (e) {
        // Ignorer
      }
    }
    
    this.mediaSource = null;
    this.sourceBuffer = null;
    
    console.log('[StreamingMSE] 🧹 Ressources nettoyées');
  }
}

