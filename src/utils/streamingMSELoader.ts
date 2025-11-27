import { clientFingerprint } from './clientFingerprint';

/**
 * Système de streaming optimisé type Netflix
 * - Démarrage ultra-rapide (2-3 segments seulement)
 * - Chargement séquentiel optimisé (compatible serveur)
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
  
  // Statistiques réseau pour monitoring
  private downloadSpeeds: number[] = [];
  private avgDownloadSpeed = 0;

  constructor(private options: StreamingLoaderOptions) {
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB par défaut pour un bon équilibre vitesse/qualité
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
   * Stratégie optimisée:
   * 1. Charger séquentiellement les premiers segments rapidement
   * 2. Démarrer la vidéo dès que 2-3 segments sont chargés
   * 3. Continuer le chargement séquentiel en arrière-plan
   * 4. Mettre à jour le blob intelligemment
   */
  private async loadWithAdaptiveStreaming(): Promise<string> {
    const videoElement = this.options.videoElement;
    
    // Stratégie: Démarrer avec seulement 2-3 segments pour un démarrage ultra-rapide
    const MIN_SEGMENTS_TO_START = Math.min(3, this.totalChunks); // Maximum 3 segments pour démarrer
    
    console.log(`[StreamingMSE] 🚀 Chargement séquentiel optimisé, démarrage à ${MIN_SEGMENTS_TO_START} segments`);
    
    let videoStarted = false;
    let currentBlobUrl = '';
    
    // Fonction pour démarrer la vidéo dès qu'on a assez de segments
    const tryStartVideo = () => {
      if (videoStarted || this.segmentCache.size < MIN_SEGMENTS_TO_START) return;
      
      // Créer le blob avec les segments disponibles (dans l'ordre séquentiel)
      const segments: ArrayBuffer[] = [];
      for (let i = 0; i < this.totalChunks; i++) {
        const segment = this.segmentCache.get(i);
        if (segment) segments.push(segment);
        else break; // Arrêter si un segment manque (séquentiel)
      }
      
      if (segments.length < MIN_SEGMENTS_TO_START) return;
      
      const blob = new Blob(segments, { type: 'video/mp4' });
      currentBlobUrl = URL.createObjectURL(blob);
      videoElement.src = currentBlobUrl;
      videoElement.load();
      videoStarted = true;
      
      console.log(`[StreamingMSE] 🎬 Vidéo prête (${segments.length}/${this.totalChunks} segments) - Démarrage ultra-rapide`);
      
      // Surveiller le buffer une fois la vidéo démarrée
      this.startSmartBuffering(currentBlobUrl);
    };
    
    // Charger tous les segments séquentiellement
    const loadAllSegments = async () => {
      for (let i = 0; i < this.totalChunks; i++) {
        if (this.isAborted || this.options.signal?.aborted) break;
        
        try {
          await this.loadSegmentWithRetry(i);
          this.updateProgress();
          
          // Essayer de démarrer la vidéo après chaque segment chargé
          if (!videoStarted) {
            tryStartVideo();
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Session expirée')) {
            this.options.onError?.(new Error('Session expirée - veuillez recharger la vidéo'));
            break;
          }
          // Continuer avec le segment suivant en cas d'erreur
          console.warn(`[StreamingMSE] ⚠️ Erreur segment ${i}, passage au suivant`);
        }
      }
      
      console.log('[StreamingMSE] ✅ Tous les segments chargés');
    };
    
    // Démarrer le chargement séquentiel
    loadAllSegments();
    
    // Attendre que la vidéo démarre (maximum 5 secondes)
    const startTime = Date.now();
    while (!videoStarted && Date.now() - startTime < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!videoStarted && this.segmentCache.size > 0) {
      // Forcer le démarrage même si on n'a pas atteint le minimum
      tryStartVideo();
    }
    
    return currentBlobUrl || '';
  }

  /**
   * Surveillance intelligente du buffer avec mise à jour prédictive
   */
  private startSmartBuffering(initialBlobUrl: string): void {
    let currentBlobUrl = initialBlobUrl;
    let lastBlobUpdateSegments = 0;
    let isUpdating = false;
    
    const checkBuffer = () => {
      if (this.isAborted || isUpdating) {
        requestAnimationFrame(checkBuffer);
        return;
      }
      
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
        (bufferAhead < 10 && loadedSegments > lastBlobUpdateSegments + 5) || // Buffer faible
        (loadedSegments === this.totalChunks && loadedSegments > lastBlobUpdateSegments) || // Tout chargé
        (duration > 0 && duration - currentTime < 20 && loadedSegments > lastBlobUpdateSegments + 3); // Proche de la fin
      
      if (shouldUpdate) {
        isUpdating = true;
        console.log(`[StreamingMSE] 📊 Mise à jour blob: ${loadedSegments}/${this.totalChunks} segments (buffer: ${bufferAhead.toFixed(1)}s)`);
        
        // Créer le nouveau blob avec tous les segments chargés (dans l'ordre séquentiel)
        const allSegments: ArrayBuffer[] = [];
        for (let i = 0; i < this.totalChunks; i++) {
          const segment = this.segmentCache.get(i);
          if (segment) allSegments.push(segment);
          else break; // Arrêter si un segment manque (séquentiel)
        }
        
        if (allSegments.length === 0) {
          isUpdating = false;
          requestAnimationFrame(checkBuffer);
          return;
        }
        
        const newBlob = new Blob(allSegments, { type: 'video/mp4' });
        const newBlobUrl = URL.createObjectURL(newBlob);
        
        // Mise à jour seamless
        const wasPlaying = !videoElement.paused;
        const savedTime = currentTime;
        
        const restorePlayback = () => {
          if (savedTime > 0 && duration > 0 && savedTime < duration) {
            videoElement.currentTime = savedTime;
          }
          setTimeout(() => {
            if (wasPlaying && videoElement.paused) {
              videoElement.play().catch(() => {});
            }
            isUpdating = false;
          }, 200);
        };
        
        const handleCanPlay = () => {
          videoElement.removeEventListener('canplay', handleCanPlay);
          videoElement.removeEventListener('loadeddata', handleLoadedData);
          restorePlayback();
        };
        
        const handleLoadedData = () => {
          videoElement.removeEventListener('loadeddata', handleLoadedData);
          videoElement.removeEventListener('canplay', handleCanPlay);
          restorePlayback();
        };
        
        videoElement.addEventListener('canplay', handleCanPlay, { once: true });
        videoElement.addEventListener('loadeddata', handleLoadedData, { once: true });
        videoElement.src = newBlobUrl;
        videoElement.load();
        
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
        const startTime = Date.now();
        const segment = await this.fetchSegment(index);
        const downloadTime = (Date.now() - startTime) / 1000;
        
        // Calculer la vitesse de téléchargement (MB/s)
        const sizeMB = segment.data.byteLength / (1024 * 1024);
        const speed = sizeMB / downloadTime;
        
        // Mettre à jour les statistiques réseau
        this.downloadSpeeds.push(speed);
        if (this.downloadSpeeds.length > 10) this.downloadSpeeds.shift();
        this.avgDownloadSpeed = this.downloadSpeeds.reduce((a, b) => a + b, 0) / this.downloadSpeeds.length;
        
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
