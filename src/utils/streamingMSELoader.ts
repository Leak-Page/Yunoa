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
  
  private totalSize = 0;
  private totalChunks = 0;

  constructor(private options: StreamingLoaderOptions) {
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB par défaut pour un chargement rapide
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo en streaming progressif avec blob
   * Note: Les segments MP4 bruts ne sont pas compatibles avec MSE
   * On utilise un système de blob progressif optimisé
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

    console.log(`[StreamingMSE] 🚀 Démarrage streaming progressif: ${this.totalChunks} segments (${Math.round(metadata.size / 1024 / 1024)} MB)`);

    // Utiliser un système de blob progressif au lieu de MSE
    // Les segments MP4 bruts ne sont pas compatibles avec MSE (il faut des fragments fMP4)
    return this.loadWithProgressiveBlob();
  }

  /**
   * Charge avec un blob progressif optimisé
   * Charge les segments séquentiellement et met à jour le blob progressivement
   */
  private async loadWithProgressiveBlob(): Promise<string> {
    const blobParts: BlobPart[] = [];
    let blobUrl: string | null = null;
    let isVideoReady = false;
    const INITIAL_CHUNKS = 5; // Charger 5 segments pour démarrer avec un bon buffer
    const UPDATE_INTERVAL = 5; // Mettre à jour le blob tous les 5 segments (moins fréquent)
    let lastUpdateChunkCount = 0;

    // Fonction pour créer/mettre à jour le blob
    const updateBlob = (force: boolean = false) => {
      if (blobParts.length === 0) return;

      // Ne pas créer de nouveau blob si on n'a pas assez de nouveaux segments
      if (!force && blobParts.length - lastUpdateChunkCount < UPDATE_INTERVAL && isVideoReady) {
        return;
      }

      const newBlob = new Blob(blobParts, { type: 'video/mp4' });
      const newBlobUrl = URL.createObjectURL(newBlob);

      if (!isVideoReady && blobParts.length >= INITIAL_CHUNKS) {
        // Première création du blob avec les premiers segments
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
        blobUrl = newBlobUrl;
        this.options.videoElement.src = blobUrl;
        this.options.videoElement.load();
        isVideoReady = true;
        lastUpdateChunkCount = blobParts.length;
        console.log(`[StreamingMSE] 🎬 Vidéo prête avec ${blobParts.length} segments`);
      } else if (isVideoReady && (force || blobParts.length - lastUpdateChunkCount >= UPDATE_INTERVAL)) {
        // Mettre à jour le blob progressivement seulement si nécessaire
        const videoElement = this.options.videoElement;
        const wasPlaying = !videoElement.paused;
        const currentTime = videoElement.currentTime || 0;
        
        // Vérifier si on a besoin de plus de données
        const bufferedEnd = videoElement.buffered.length > 0 
          ? videoElement.buffered.end(videoElement.buffered.length - 1) 
          : 0;
        const duration = videoElement.duration || 0;
        const bufferAhead = bufferedEnd - currentTime;
        
        // Mettre à jour seulement si le buffer est vraiment faible ou si on force
        if (force || bufferAhead < 5 || (duration > 0 && duration - currentTime < 20)) {
          // Sauvegarder l'état avant de changer la source
          const savedTime = currentTime;
          const savedPlaying = wasPlaying;
          
          // Changer la source
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
          }
          blobUrl = newBlobUrl;
          
          // Attendre que la nouvelle source soit prête avant de restaurer
          const handleLoadedMetadata = () => {
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            if (savedTime > 0) {
              videoElement.currentTime = savedTime;
            }
            if (savedPlaying) {
              videoElement.play().catch(() => {});
            }
            lastUpdateChunkCount = blobParts.length;
            console.log(`[StreamingMSE] 📊 Blob mis à jour avec ${blobParts.length} segments`);
          };
          
          videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
          videoElement.src = blobUrl;
          videoElement.load();
        } else {
          // Pas besoin de mettre à jour maintenant, libérer le blob
          URL.revokeObjectURL(newBlobUrl);
        }
      } else {
        // Pas besoin de mettre à jour, libérer le blob
        URL.revokeObjectURL(newBlobUrl);
      }
    };

    // Charger les segments séquentiellement
    for (let i = 0; i < this.totalChunks; i++) {
      if (this.isAborted || this.options.signal?.aborted) {
        break;
      }

      try {
        const segment = await this.fetchSegment(i);
        
        // Ajouter le segment au blob
        blobParts.push(segment.data);
        
        // Mettre à jour le token et le hash
        this.currentToken = segment.nextToken;
        this.lastHash = segment.nextHash;

        // Mettre à jour la progression
        if (this.options.onProgress) {
          const loaded = blobParts.length * this.chunkSize;
          this.options.onProgress(Math.min(loaded, this.totalSize), this.totalSize);
        }

        // Mettre à jour le blob progressivement (seulement si nécessaire)
        // Ne pas mettre à jour à chaque segment pour éviter les interruptions
        if (!isVideoReady || blobParts.length % UPDATE_INTERVAL === 0) {
          updateBlob(false);
        }

        // Si la vidéo est prête, vérifier le buffer et charger plus si nécessaire
        if (isVideoReady) {
          const videoElement = this.options.videoElement;
          const bufferedEnd = videoElement.buffered.length > 0 
            ? videoElement.buffered.end(videoElement.buffered.length - 1) 
            : 0;
          const currentTime = videoElement.currentTime || 0;
          const bufferAhead = bufferedEnd - currentTime;
          
          // Si le buffer est très faible, forcer une mise à jour
          if (bufferAhead < 3) {
            updateBlob(true);
          }
        }

      } catch (error) {
        console.error(`[StreamingMSE] ❌ Erreur segment ${i}:`, error);
        // Réessayer après un délai
        await new Promise(resolve => setTimeout(resolve, 1000));
        i--; // Réessayer le même segment
        continue;
      }
    }

    // Mise à jour finale du blob
    updateBlob(true);

    console.log('[StreamingMSE] ✅ Tous les segments chargés');
    
    return blobUrl || '';
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
      fingerprint: this.fingerprint!
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
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    this.abort();
    console.log('[StreamingMSE] 🧹 Ressources nettoyées');
  }
}

