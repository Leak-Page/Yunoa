import { clientFingerprint } from './clientFingerprint';

/**
 * Système de streaming optimisé - Solution ultra-rapide
 * - Chargement séquentiel optimisé (compatible serveur)
 * - Démarrage dès que possible avec blob partiel valide
 * - Mise à jour progressive du blob
 * - Objectif: 10-15 secondes pour 49 MB
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
    // Chunks plus petits = chargement plus rapide (512KB au lieu de 1MB)
    this.chunkSize = options.chunkSize || 512 * 1024; // 512KB pour un chargement plus rapide
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

    console.log(`[StreamingMSE] 🚀 Chargement optimisé: ${this.totalChunks} segments (${Math.round(metadata.size / 1024 / 1024)} MB)`);

    return this.loadWithProgressiveBlob();
  }

  /**
   * Chargement séquentiel optimisé avec blob progressif
   * Stratégie:
   * 1. Charger séquentiellement très rapidement
   * 2. Démarrer la vidéo dès qu'on a 5-10 segments (blob partiel mais valide)
   * 3. Continuer à charger en arrière-plan
   * 4. Mettre à jour le blob progressivement
   */
  private async loadWithProgressiveBlob(): Promise<string> {
    const videoElement = this.options.videoElement;
    
    // Démarrer avec 5-10 segments pour un démarrage rapide
    const MIN_SEGMENTS_TO_START = Math.min(10, Math.ceil(this.totalChunks * 0.2));
    
    console.log(`[StreamingMSE] 🚀 Chargement séquentiel optimisé, démarrage à ${MIN_SEGMENTS_TO_START} segments`);
    
    let videoStarted = false;
    let currentBlobUrl = '';
    let lastUpdateCount = 0;
    
    // Fonction pour créer/mettre à jour le blob
    const updateBlob = (force: boolean = false) => {
      if (this.segmentCache.size === 0) return;
      
      // Créer le blob avec tous les segments chargés (dans l'ordre)
      const segments: ArrayBuffer[] = [];
      for (let i = 0; i < this.totalChunks; i++) {
        const segment = this.segmentCache.get(i);
        if (segment) segments.push(segment);
        else break; // Arrêter si un segment manque (séquentiel)
      }
      
      if (segments.length === 0) return;
      
      // Démarrer la vidéo si on a assez de segments
      if (!videoStarted && segments.length >= MIN_SEGMENTS_TO_START) {
        const blob = new Blob(segments, { type: 'video/mp4' });
        currentBlobUrl = URL.createObjectURL(blob);
        videoElement.src = currentBlobUrl;
        videoElement.load();
        videoStarted = true;
        lastUpdateCount = segments.length;
        console.log(`[StreamingMSE] 🎬 Vidéo prête (${segments.length}/${this.totalChunks} segments) - Démarrage rapide`);
        
        // Démarrer la surveillance du buffer
        this.startBufferMonitoring(currentBlobUrl, () => lastUpdateCount);
        return;
      }
      
      // Mettre à jour le blob si nécessaire
      if (videoStarted && (force || segments.length > lastUpdateCount + 5)) {
        const wasPlaying = !videoElement.paused;
        const savedTime = videoElement.currentTime || 0;
        const duration = videoElement.duration || 0;
        
        const newBlob = new Blob(segments, { type: 'video/mp4' });
        const newBlobUrl = URL.createObjectURL(newBlob);
        
        const restorePlayback = () => {
          if (savedTime > 0 && duration > 0 && savedTime < duration) {
            videoElement.currentTime = savedTime;
          }
          setTimeout(() => {
            if (wasPlaying && videoElement.paused) {
              videoElement.play().catch(() => {});
            }
          }, 100);
        };
        
        const handleCanPlay = () => {
          videoElement.removeEventListener('canplay', handleCanPlay);
          restorePlayback();
        };
        
        videoElement.addEventListener('canplay', handleCanPlay, { once: true });
        videoElement.src = newBlobUrl;
        videoElement.load();
        
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = newBlobUrl;
        lastUpdateCount = segments.length;
      }
    };
    
    // Charger tous les segments séquentiellement de manière optimisée
    const loadAllSegments = async () => {
      for (let i = 0; i < this.totalChunks; i++) {
        if (this.isAborted || this.options.signal?.aborted) break;
        
        try {
          await this.loadSegmentWithRetry(i);
          this.updateProgress();
          
          // Mettre à jour le blob après chaque segment
          updateBlob(false);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Session expirée')) {
            this.options.onError?.(new Error('Session expirée - veuillez recharger la vidéo'));
            break;
          }
          console.warn(`[StreamingMSE] ⚠️ Erreur segment ${i}, passage au suivant`);
        }
      }
      
      // Mise à jour finale
      updateBlob(true);
      console.log(`[StreamingMSE] ✅ ${this.segmentCache.size}/${this.totalChunks} segments chargés`);
    };
    
    // Démarrer le chargement
    loadAllSegments();
    
    // Attendre que la vidéo démarre (maximum 3 secondes)
    const startTime = Date.now();
    while (!videoStarted && Date.now() - startTime < 3000) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return currentBlobUrl || '';
  }

  /**
   * Surveillance du buffer pour mettre à jour le blob si nécessaire
   */
  private startBufferMonitoring(initialBlobUrl: string, getLastUpdateCount: () => number): void {
    let currentBlobUrl = initialBlobUrl;
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
      const lastUpdate = getLastUpdateCount();
      
      // Mettre à jour si le buffer est faible et qu'on a plus de segments
      if (bufferAhead < 8 && loadedSegments > lastUpdate + 5) {
        isUpdating = true;
        console.log(`[StreamingMSE] 📊 Buffer faible (${bufferAhead.toFixed(1)}s), mise à jour...`);
        
        const segments: ArrayBuffer[] = [];
        for (let i = 0; i < this.totalChunks; i++) {
          const segment = this.segmentCache.get(i);
          if (segment) segments.push(segment);
          else break;
        }
        
        if (segments.length > 0) {
          const wasPlaying = !videoElement.paused;
          const savedTime = currentTime;
          
          const newBlob = new Blob(segments, { type: 'video/mp4' });
          const newBlobUrl = URL.createObjectURL(newBlob);
          
          const restorePlayback = () => {
            if (savedTime > 0 && duration > 0 && savedTime < duration) {
              videoElement.currentTime = savedTime;
            }
            setTimeout(() => {
              if (wasPlaying && videoElement.paused) {
                videoElement.play().catch(() => {});
              }
              isUpdating = false;
            }, 100);
          };
          
          const handleCanPlay = () => {
            videoElement.removeEventListener('canplay', handleCanPlay);
            restorePlayback();
          };
          
          videoElement.addEventListener('canplay', handleCanPlay, { once: true });
          videoElement.src = newBlobUrl;
          videoElement.load();
          
          URL.revokeObjectURL(currentBlobUrl);
          currentBlobUrl = newBlobUrl;
        } else {
          isUpdating = false;
        }
      }
      
      requestAnimationFrame(checkBuffer);
    };
    
    requestAnimationFrame(checkBuffer);
  }

  /**
   * Charge un segment avec retry optimisé
   */
  private async loadSegmentWithRetry(index: number, maxRetries = 2): Promise<void> {
    if (this.loadingSegments.has(index) || this.segmentCache.has(index)) {
      return;
    }
    
    this.loadingSegments.add(index);
    
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        const segment = await this.fetchSegment(index);
        
        // Sauvegarder le segment
        this.segmentCache.set(index, segment.data);
        this.currentToken = segment.nextToken;
        this.lastHash = segment.nextHash;
        
        this.loadingSegments.delete(index);
        return;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Erreurs fatales
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
        
        // Délai court pour retry rapide
        await new Promise(resolve => setTimeout(resolve, 200 * (retry + 1)));
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
