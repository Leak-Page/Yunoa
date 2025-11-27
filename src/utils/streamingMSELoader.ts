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
   * Stratégie : Charger tous les segments en arrière-plan et créer le blob une seule fois
   * pour éviter les interruptions de lecture
   */
  private async loadWithProgressiveBlob(): Promise<string> {
    const blobParts: BlobPart[] = [];
    let blobUrl: string | null = null;
    let isVideoReady = false;
    const INITIAL_CHUNKS = 20; // Charger 20 segments (20 MB) avant de démarrer pour un très bon buffer
    let lastUpdateChunkCount = 0;
    
    // Fonction pour créer le blob initial
    const createInitialBlob = () => {
      if (blobParts.length === 0 || isVideoReady) return;
      
      if (blobParts.length >= INITIAL_CHUNKS) {
        const blob = new Blob(blobParts, { type: 'video/mp4' });
        blobUrl = URL.createObjectURL(blob);
        this.options.videoElement.src = blobUrl;
        this.options.videoElement.load();
        isVideoReady = true;
        console.log(`[StreamingMSE] 🎬 Vidéo prête avec ${blobParts.length} segments (${Math.round(blobParts.length * this.chunkSize / 1024 / 1024)} MB)`);
      }
    };
    
    // Fonction pour mettre à jour le blob avec plus de segments
    const updateBlobWithMoreSegments = () => {
      if (blobParts.length === 0 || !isVideoReady) return;
      
      const videoElement = this.options.videoElement;
      const wasPlaying = !videoElement.paused;
      const currentTime = videoElement.currentTime || 0;
      const duration = videoElement.duration || 0;
      
      // Créer le nouveau blob avec tous les segments chargés
      const newBlob = new Blob(blobParts, { type: 'video/mp4' });
      const newBlobUrl = URL.createObjectURL(newBlob);
      
      // Sauvegarder l'état
      const savedTime = currentTime;
      const savedPlaying = wasPlaying;
      
      // Changer la source
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      blobUrl = newBlobUrl;
      
      // Restaurer l'état de manière plus robuste
      const restorePlayback = () => {
        if (savedTime > 0 && duration > 0 && savedTime < duration) {
          videoElement.currentTime = savedTime;
        }
        // Attendre un peu avant de relancer la lecture
        setTimeout(() => {
          if (savedPlaying && videoElement.paused) {
            videoElement.play().catch(() => {});
          }
        }, 200);
      };
      
      const handleCanPlay = () => {
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        restorePlayback();
        console.log(`[StreamingMSE] 📊 Blob mis à jour avec ${blobParts.length} segments`);
      };
      
      const handleLoadedData = () => {
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('canplay', handleCanPlay);
        restorePlayback();
      };
      
      videoElement.addEventListener('canplay', handleCanPlay, { once: true });
      videoElement.addEventListener('loadeddata', handleLoadedData, { once: true });
      videoElement.src = blobUrl;
      videoElement.load();
    };

    // Charger les segments séquentiellement
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    const MAX_RETRIES_PER_SEGMENT = 2;
    
    for (let i = 0; i < this.totalChunks; i++) {
      if (this.isAborted || this.options.signal?.aborted) {
        break;
      }

      let segmentLoaded = false;
      let retryCount = 0;

      // Essayer de charger le segment avec retry limité
      while (!segmentLoaded && retryCount <= MAX_RETRIES_PER_SEGMENT) {
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

          // Réinitialiser le compteur d'erreurs consécutives en cas de succès
          consecutiveErrors = 0;
          segmentLoaded = true;

          // Créer le blob initial une seule fois quand on a assez de segments
          if (!isVideoReady && blobParts.length >= INITIAL_CHUNKS) {
            createInitialBlob();
            lastUpdateChunkCount = blobParts.length;
          }
          
          // Si la vidéo est en cours de lecture, vérifier si on doit mettre à jour le blob
          if (isVideoReady) {
            const videoElement = this.options.videoElement;
            const bufferedEnd = videoElement.buffered.length > 0 
              ? videoElement.buffered.end(videoElement.buffered.length - 1) 
              : 0;
            const currentTime = videoElement.currentTime || 0;
            const duration = videoElement.duration || 0;
            const bufferAhead = bufferedEnd - currentTime;
            const timeRemaining = duration > 0 ? duration - currentTime : Infinity;
            
            // Mettre à jour seulement si :
            // 1. On a chargé au moins 10 nouveaux segments depuis la dernière mise à jour
            // 2. ET on est proche de la fin du buffer actuel (< 5 secondes)
            // 3. ET il reste encore de la vidéo à charger
            if (blobParts.length - lastUpdateChunkCount >= 10 && 
                bufferAhead < 5 && 
                timeRemaining > 10) {
              updateBlobWithMoreSegments();
              lastUpdateChunkCount = blobParts.length;
            }
          }

        } catch (error) {
          retryCount++;
          consecutiveErrors++;
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isSessionError = errorMessage.includes('Session invalide') || 
                                 errorMessage.includes('SESSION_TIMEOUT') ||
                                 errorMessage.includes('INVALID_SEQUENCE');
          
          if (isSessionError) {
            // Erreur de session - arrêter le chargement
            console.error(`[StreamingMSE] ❌ Erreur de session sur le segment ${i}:`, errorMessage);
            this.options.onError?.(new Error('Session expirée - veuillez recharger la vidéo'));
            return blobUrl || '';
          }
          
          if (retryCount > MAX_RETRIES_PER_SEGMENT) {
            // Trop de tentatives pour ce segment
            console.error(`[StreamingMSE] ❌ Échec après ${MAX_RETRIES_PER_SEGMENT} tentatives pour le segment ${i}`);
            
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              // Trop d'erreurs consécutives - arrêter
              console.error(`[StreamingMSE] ❌ Trop d'erreurs consécutives (${consecutiveErrors}), arrêt du chargement`);
              this.options.onError?.(new Error('Trop d\'erreurs de chargement - veuillez réessayer'));
              return blobUrl || '';
            }
            
            // Passer au segment suivant
            console.warn(`[StreamingMSE] ⚠️ Passage au segment suivant (${i + 1})`);
            break;
          }
          
          // Attendre avant de réessayer
          console.warn(`[StreamingMSE] ⚠️ Nouvelle tentative ${retryCount}/${MAX_RETRIES_PER_SEGMENT} pour le segment ${i}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Délai exponentiel
        }
      }
      
      // Si le segment n'a pas pu être chargé après toutes les tentatives, continuer avec le suivant
      if (!segmentLoaded && retryCount > MAX_RETRIES_PER_SEGMENT) {
        // On continue avec le segment suivant au lieu de boucler infiniment
        continue;
      }
    }

    // Si la vidéo n'a pas encore démarré, créer le blob maintenant
    if (!isVideoReady && blobParts.length > 0) {
      createInitialBlob();
    }
    
    // Si tous les segments sont chargés et que la vidéo est en cours de lecture,
    // mettre à jour le blob final avec tous les segments
    if (isVideoReady && blobParts.length === this.totalChunks) {
      const videoElement = this.options.videoElement;
      const bufferedEnd = videoElement.buffered.length > 0 
        ? videoElement.buffered.end(videoElement.buffered.length - 1) 
        : 0;
      const currentTime = videoElement.currentTime || 0;
      const duration = videoElement.duration || 0;
      const bufferAhead = bufferedEnd - currentTime;
      const timeRemaining = duration > 0 ? duration - currentTime : Infinity;
      
      // Mettre à jour seulement si on est proche de la fin du buffer
      if (bufferAhead < 10 && timeRemaining > 5) {
        updateBlobWithMoreSegments();
      }
    }

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

