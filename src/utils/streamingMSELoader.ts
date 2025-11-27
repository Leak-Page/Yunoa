import { clientFingerprint } from './clientFingerprint';

/**
 * Système de streaming optimisé type Netflix
 * - Démarrage ultra-rapide (2-3 segments seulement)
 * - Chargement parallèle intelligent avec priorités
 * - Gestion adaptative de la qualité réseau
 * - Buffer prédictif basé sur la position de lecture
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
  chunkSize?: number;
}

export class StreamingMSELoader {
  private chunkSize: number;
  private currentToken: string;
  private fingerprint: string | null = null;
  private lastHash: string | null = null;
  private sessionId: string | null = null;
  private isAborted = false;
  
  private totalSize = 0;
  private totalChunks = 0;
  
  // Cache des segments chargés
  private segmentCache = new Map<number, ArrayBuffer>();
  private loadingSegments = new Set<number>();

  constructor(private options: StreamingLoaderOptions) {
    this.chunkSize = options.chunkSize || 512 * 1024; // 512KB par défaut (plus petit = plus rapide au démarrage)
    this.currentToken = options.sessionToken;
  }

  async load(): Promise<string> {
    this.fingerprint = await clientFingerprint.generate();
    if (!this.fingerprint) {
      throw new Error('Impossible de générer l\'empreinte du client');
    }

    const metadata = await this.fetchMetadata();
    this.totalSize = metadata.size;
    this.totalChunks = Math.ceil(metadata.size / this.chunkSize);
    
    if (metadata.sessionId) this.sessionId = metadata.sessionId;
    if (metadata.initialToken) this.currentToken = metadata.initialToken;

    console.log(`[StreamingMSE] 🚀 Démarrage: ${this.totalChunks} segments (${Math.round(metadata.size / 1024 / 1024)} MB)`);

    return this.loadWithAdaptiveStreaming();
  }

  /**
   * Streaming adaptatif type Netflix
   * Stratégie:
   * 1. Démarrer TRÈS rapidement avec 2-3 segments
   * 2. Charger en parallèle les segments suivants
   * 3. Prédire les besoins basés sur la position de lecture
   * 4. Adapter le nombre de connexions parallèles selon le réseau
   */
  private async loadWithAdaptiveStreaming(): Promise<string> {
    const videoElement = this.options.videoElement;
    
    // ÉTAPE 1: Démarrage ultra-rapide avec segments initiaux
    const INITIAL_SEGMENTS = 3; // 2-3 segments = ~1-2 secondes de vidéo
    const initialSegments = await this.loadInitialSegments(INITIAL_SEGMENTS);
    
    // Créer et démarrer la vidéo immédiatement
    const blob = new Blob([...initialSegments.values()], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);
    videoElement.src = blobUrl;
    videoElement.load();
    
    console.log(`[StreamingMSE] 🎬 Vidéo prête (${INITIAL_SEGMENTS} segments) - Démarrage instantané`);
    
    // ÉTAPE 2: Charger le reste en arrière-plan de manière intelligente
    this.startBackgroundLoading(INITIAL_SEGMENTS);
    
    // ÉTAPE 3: Surveiller et mettre à jour le blob quand nécessaire
    this.startSmartBuffering(blobUrl);
    
    return blobUrl;
  }

  /**
   * Charge les segments initiaux séquentiellement pour un démarrage rapide
   * Le serveur exige un chargement séquentiel strict (0, 1, 2, 3...)
   */
  private async loadInitialSegments(count: number): Promise<Map<number, ArrayBuffer>> {
    // Charger séquentiellement les premiers segments
    for (let i = 0; i < Math.min(count, this.totalChunks); i++) {
      await this.loadSegmentWithRetry(i);
    }
    
    return this.segmentCache;
  }

  /**
   * Charge les segments restants en arrière-plan de manière séquentielle
   * Le serveur exige un chargement séquentiel strict
   */
  private startBackgroundLoading(startIndex: number): void {
    const loadNext = async () => {
      if (this.isAborted || this.options.signal?.aborted) return;
      
      // Trouver le prochain segment à charger (séquentiel)
      let nextIndex = startIndex;
      while (nextIndex < this.totalChunks) {
        if (!this.segmentCache.has(nextIndex) && !this.loadingSegments.has(nextIndex)) {
          break;
        }
        nextIndex++;
      }
      
      if (nextIndex >= this.totalChunks) {
        console.log('[StreamingMSE] ✅ Tous les segments chargés');
        return;
      }
      
      // Charger le segment suivant
      try {
        await this.loadSegmentWithRetry(nextIndex);
        this.updateProgress();
        
        // Continuer immédiatement avec le segment suivant
        loadNext();
      } catch (error) {
        // En cas d'erreur, réessayer après un court délai
        setTimeout(loadNext, 500);
      }
    };
    
    // Démarrer le chargement en arrière-plan
    loadNext();
  }

  /**
   * Surveillance intelligente du buffer avec mise à jour prédictive
   */
  private startSmartBuffering(initialBlobUrl: string): void {
    let currentBlobUrl = initialBlobUrl;
    let lastBlobUpdateSegments = 3;
    
    const checkBuffer = () => {
      if (this.isAborted) return;
      
      const videoElement = this.options.videoElement;
      if (!videoElement.buffered.length) {
        requestAnimationFrame(checkBuffer);
        return;
      }
      
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;
      const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
      const bufferAhead = bufferedEnd - currentTime;
      const loadedSegments = this.segmentCache.size;
      
      // Prédire les besoins: mettre à jour si on approche de la fin du buffer
      // ou si on a chargé significativement plus de segments
      const shouldUpdate = 
        (bufferAhead < 15 && loadedSegments > lastBlobUpdateSegments + 5) || // Buffer faible
        (loadedSegments === this.totalChunks && loadedSegments > lastBlobUpdateSegments) || // Tout chargé
        (duration - currentTime < 30 && loadedSegments > lastBlobUpdateSegments + 3); // Proche de la fin
      
      if (shouldUpdate) {
        console.log(`[StreamingMSE] 📊 Mise à jour blob: ${loadedSegments}/${this.totalChunks} segments (buffer: ${bufferAhead.toFixed(1)}s)`);
        
        // Créer le nouveau blob avec tous les segments chargés
        const allSegments: ArrayBuffer[] = [];
        for (let i = 0; i < this.totalChunks; i++) {
          const segment = this.segmentCache.get(i);
          if (segment) allSegments.push(segment);
        }
        
        const newBlob = new Blob(allSegments, { type: 'video/mp4' });
        const newBlobUrl = URL.createObjectURL(newBlob);
        
        // Mise à jour seamless
        const wasPlaying = !videoElement.paused;
        const savedTime = currentTime;
        
        videoElement.src = newBlobUrl;
        videoElement.currentTime = savedTime;
        if (wasPlaying) {
          videoElement.play().catch(() => {});
        }
        
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = newBlobUrl;
        lastBlobUpdateSegments = loadedSegments;
      }
      
      requestAnimationFrame(checkBuffer);
    };
    
    requestAnimationFrame(checkBuffer);
  }

  /**
   * Charge un segment avec retry intelligent
   */
  private async loadSegmentWithRetry(index: number, maxRetries = 2): Promise<void> {
    if (this.loadingSegments.has(index) || this.segmentCache.has(index)) {
      return;
    }
    
    this.loadingSegments.add(index);
    
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        // Charger le segment
        const segment = await this.fetchSegment(index);
        
        // Sauvegarder le segment
        this.segmentCache.set(index, segment.data);
        this.currentToken = segment.nextToken;
        this.lastHash = segment.nextHash;
        
        this.loadingSegments.delete(index);
        return;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('Session invalide') || 
            errorMessage.includes('SESSION_TIMEOUT') ||
            errorMessage.includes('INVALID_SEQUENCE')) {
          this.loadingSegments.delete(index);
          throw new Error('Session expirée');
        }
        
        if (retry === maxRetries) {
          console.warn(`[StreamingMSE] ⚠️ Échec segment ${index} après ${maxRetries} tentatives`);
          this.loadingSegments.delete(index);
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500 * (retry + 1)));
      }
    }
  }

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

  private async fetchSegment(chunkIndex: number): Promise<SegmentResponse> {
    const request: SegmentRequest = {
      videoId: this.options.videoId,
      chunkIndex,
      timestamp: Date.now(),
      fingerprint: this.fingerprint!
    };

    if (this.sessionId) request.sessionId = this.sessionId;
    if (chunkIndex > 0 && this.lastHash) request.previousHash = this.lastHash;

    const response = await fetch(`/api/videos/secure-stream/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`,
        'X-Chunk-Index': chunkIndex.toString(),
        'X-Total-Chunks': this.totalChunks.toString(),
        'X-Chunk-Size': this.chunkSize.toString()
      },
      body: JSON.stringify(request),
      signal: this.options.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur segment ${chunkIndex}: ${response.status} - ${errorText}`);
    }

    const nextToken = response.headers.get('X-Next-Token');
    const nextHash = response.headers.get('X-Next-Hash');
    const expiresAt = parseInt(response.headers.get('X-Expires-At') || '0');

    if (!nextToken || !nextHash) {
      throw new Error('Réponse invalide du serveur');
    }

    const data = await response.arrayBuffer();

    return { data, nextToken, nextHash, expiresAt };
  }

  private updateProgress(): void {
    if (this.options.onProgress) {
      const loadedBytes = Array.from(this.segmentCache.values())
        .reduce((sum, seg) => sum + seg.byteLength, 0);
      this.options.onProgress(Math.min(loadedBytes, this.totalSize), this.totalSize);
    }
  }

  abort(): void {
    this.isAborted = true;
  }

  cleanup(): void {
    this.abort();
    this.segmentCache.clear();
    this.loadingSegments.clear();
    console.log('[StreamingMSE] 🧹 Ressources nettoyées');
  }
}
