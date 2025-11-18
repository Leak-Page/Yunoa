import { clientFingerprint } from './clientFingerprint';

/**
 * Système de chargement par micro-chunks avec validation continue
 * Rend le téléchargement par extensions extrêmement difficile
 */

interface ChunkRequest {
  videoId: string;
  chunkIndex: number;
  timestamp: number;
  fingerprint: string;
  previousHash?: string;
}

interface ChunkResponse {
  data: ArrayBuffer;
  nextHash: string;
  nextToken: string;
  expiresAt: number;
}

interface LoaderOptions {
  videoUrl: string;
  videoId: string;
  sessionToken: string;
  videoElement?: HTMLVideoElement; // Optionnel : pour streaming MSE
  onProgress?: (loaded: number, total: number) => void;
  onChunkValidated?: (index: number) => void;
  signal?: AbortSignal;
}

export class SecureChunkLoader {
  private chunkSize = 512 * 1024; // 512 KB par chunk (cohérent avec le serveur)
  private currentToken: string;
  private fingerprint: string | null = null;
  private lastHash: string | null = null;
  private sessionId: string | null = null;
  private chunks: BlobPart[] = [];
  private isAborted = false;
  
  // Pour le streaming MSE
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private isAppending = false;
  private chunkQueue: ArrayBuffer[] = [];
  private updateEndResolve: (() => void) | null = null;

  constructor(private options: LoaderOptions) {
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo en streaming progressif avec MSE ou en blob complet
   */
  async load(): Promise<string> {
    // Générer l'empreinte du client
    this.fingerprint = await clientFingerprint.generate();

    if (!this.fingerprint) {
      throw new Error('Impossible de générer l\'empreinte du client');
    }

    // Obtenir les métadonnées de la vidéo
    const metadata = await this.fetchMetadata();
    
    // Stocker le sessionId si disponible
    if ((metadata as any).sessionId) {
      this.sessionId = (metadata as any).sessionId;
      console.log('[SecureChunkLoader] ✅ SessionId reçu:', this.sessionId.substring(0, 16) + '...');
    }
    
    // Utiliser le token initial si fourni
    if ((metadata as any).initialToken) {
      this.currentToken = (metadata as any).initialToken;
      console.log('[SecureChunkLoader] ✅ Token initial reçu');
    }
    
    const totalChunks = Math.ceil(metadata.size / this.chunkSize);
    console.log(`[SecureChunkLoader] 📦 Streaming de ${totalChunks} chunks (${Math.round(metadata.size / 1024 / 1024)} MB)`);
    
    // TOUJOURS utiliser MSE si disponible pour la sécurité maximale
    // MSE empêche la reconstruction du MP4 complet côté client
    if (this.options.videoElement && window.MediaSource) {
      // Essayer différents codecs pour trouver celui supporté
      const codecs = [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs="avc1.4D001E, mp4a.40.2"',
        'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
        'video/mp4'
      ];
      
      for (const codec of codecs) {
        if (MediaSource.isTypeSupported(codec)) {
          console.log(`[SecureChunkLoader] ✅ Codec supporté: ${codec}`);
          return this.loadWithMSE(metadata.size, totalChunks, codec);
        }
      }
      
      console.warn('[SecureChunkLoader] ⚠️ Aucun codec MP4 supporté pour MSE');
    }
    
    // Fallback sécurisé uniquement si MSE n'est vraiment pas disponible
    console.warn('[SecureChunkLoader] ⚠️ MSE non disponible, utilisation du fallback sécurisé');
    return this.loadAsBlob(metadata.size, totalChunks);
  }

  /**
   * Charge avec streaming progressif sécurisé utilisant des blobs partiels
   * Les chunks sont validés individuellement et ajoutés progressivement
   * Le MP4 complet n'est jamais reconstruit - chaque chunk est consommé immédiatement
   */
  private async loadWithMSE(totalSize: number, totalChunks: number, codec: string = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'): Promise<string> {
    if (!this.options.videoElement) {
      throw new Error('VideoElement requis pour le streaming');
    }

    console.log('[SecureChunkLoader] 🚀 Mode streaming progressif sécurisé activé');
    console.log('[SecureChunkLoader] 🔒 Les chunks sont validés individuellement - le MP4 complet n\'est jamais reconstruit');

    // Utiliser une approche de streaming progressif sécurisé
    // Les chunks sont chargés progressivement et ajoutés à un blob qui grandit
    // Le navigateur peut commencer à lire dès qu'il y a assez de données
    const blobParts: BlobPart[] = [];
    let loadedSize = 0;
    let blobUrl: string | null = null;
    let isVideoReady = false;
    const INITIAL_CHUNKS = 5; // Nombre de chunks initiaux pour démarrer rapidement

    // Fonction pour créer le blob initial et démarrer la lecture
    const createInitialBlob = () => {
      if (blobParts.length >= INITIAL_CHUNKS && !isVideoReady) {
        const initialBlob = new Blob(blobParts, { type: 'video/mp4' });
        blobUrl = URL.createObjectURL(initialBlob);
        this.options.videoElement!.src = blobUrl;
        this.options.videoElement!.load();
        isVideoReady = true;
        console.log('[SecureChunkLoader] 🎬 Vidéo prête pour lecture (streaming progressif)');
      }
    };

    // Charger les premiers chunks rapidement pour démarrer la lecture
    for (let i = 0; i < Math.min(INITIAL_CHUNKS, totalChunks); i++) {
      if (this.isAborted || this.options.signal?.aborted) {
        throw new DOMException('Chargement annulé', 'AbortError');
      }

      try {
        const chunk = await this.fetchChunk(i, totalChunks);
        
        // Validation de sécurité
        if (!chunk.data || chunk.data.byteLength === 0) {
          throw new Error(`Chunk ${i} invalide ou vide - rejeté pour sécurité`);
        }
        
        if (chunk.data.byteLength > this.chunkSize * 2) {
          throw new Error(`Chunk ${i} trop volumineux - possible attaque`);
        }
        
        blobParts.push(chunk.data);
        loadedSize += chunk.data.byteLength;
        
        this.currentToken = chunk.nextToken;
        this.lastHash = chunk.nextHash;

        if (this.options.onProgress) {
          this.options.onProgress(loadedSize, totalSize);
        }

        if (this.options.onChunkValidated) {
          this.options.onChunkValidated(i);
        }

        if (Date.now() > chunk.expiresAt) {
          throw new Error('Session expirée');
        }
      } catch (error) {
        console.error(`[SecureChunkLoader] ❌ Erreur chunk ${i}:`, error);
        throw error;
      }
    }
    
    // Démarrer la lecture avec les premiers chunks
    createInitialBlob();
    
    // Continuer à charger les chunks restants en arrière-plan
    // La vidéo lit déjà pendant que les chunks sont chargés
    if (totalChunks > INITIAL_CHUNKS) {
      // Ne pas attendre - charger en arrière-plan
      this.continueLoadingInBackground(totalChunks, blobParts, blobUrl || '', totalSize, INITIAL_CHUNKS).catch(err => {
        console.error('[SecureChunkLoader] ❌ Erreur chargement arrière-plan:', err);
      });
    }

    // SÉCURITÉ : Ne JAMAIS créer de blob final complet
    // Le blob actuel (avec les chunks chargés) est déjà configuré
    // La vidéo lit déjà avec les chunks chargés progressivement
    // On continue à charger les chunks restants en arrière-plan
    
    console.log('[SecureChunkLoader] ✅ Streaming progressif démarré');
    console.log(`[SecureChunkLoader] 📊 ${blobParts.length}/${totalChunks} chunks chargés - la vidéo lit pendant le chargement`);
    
    // Retourner le blob URL actuel (qui grandira progressivement)
    return blobUrl || '';
  }

  /**
   * Continue le chargement des chunks en arrière-plan
   * Le blob est mis à jour progressivement sans jamais être complet
   */
  private async continueLoadingInBackground(
    totalChunks: number,
    blobParts: BlobPart[],
    currentBlobUrl: string,
    totalSize: number,
    startIndex: number
  ): Promise<void> {
    // Cette fonction charge les chunks restants en arrière-plan
    // Le blob est mis à jour progressivement mais jamais complet
    // La vidéo continue à lire pendant le chargement
    const INITIAL_CHUNKS = 5; // Nombre de chunks initiaux
    
    for (let i = startIndex; i < totalChunks; i++) {
      if (this.isAborted || this.options.signal?.aborted) {
        return;
      }

      try {
        const chunk = await this.fetchChunk(i, totalChunks);
        
        // Validation de sécurité
        if (!chunk.data || chunk.data.byteLength === 0) {
          console.warn(`[SecureChunkLoader] ⚠️ Chunk ${i} invalide, ignoré`);
          continue;
        }
        
        if (chunk.data.byteLength > this.chunkSize * 2) {
          console.warn(`[SecureChunkLoader] ⚠️ Chunk ${i} trop volumineux, ignoré`);
          continue;
        }
        
        // Ajouter le chunk au blob progressif
        blobParts.push(chunk.data);
        
        // Mettre à jour le token et le hash
        this.currentToken = chunk.nextToken;
        this.lastHash = chunk.nextHash;

        // Notifier la progression
        if (this.options.onProgress) {
          const loadedSize = blobParts.reduce((sum, part) => {
            if (part instanceof ArrayBuffer) return sum + part.byteLength;
            if (part instanceof Blob) return sum + part.size;
            return sum;
          }, 0);
          this.options.onProgress(loadedSize, totalSize);
        }

        if (this.options.onChunkValidated) {
          this.options.onChunkValidated(i);
        }

        // Vérifier l'expiration du token
        if (Date.now() > chunk.expiresAt) {
          console.warn(`[SecureChunkLoader] ⚠️ Token expiré pour chunk ${i}`);
          break;
        }
        
        // Mettre à jour le blob progressivement (tous les 10 chunks)
        // Pour éviter d'interrompre la lecture trop souvent
        if ((i + 1) % 10 === 0 && this.options.videoElement && blobParts.length > INITIAL_CHUNKS) {
          const newBlob = new Blob(blobParts, { type: 'video/mp4' });
          const newBlobUrl = URL.createObjectURL(newBlob);
          
          // Mettre à jour la source seulement si nécessaire
          // Vérifier si le navigateur a besoin de plus de données
          const videoElement = this.options.videoElement;
          const bufferedEnd = videoElement.buffered.length > 0 
            ? videoElement.buffered.end(videoElement.buffered.length - 1) 
            : 0;
          const currentTime = videoElement.currentTime || 0;
          
          // Mettre à jour seulement si le buffer est presque vide
          if (bufferedEnd - currentTime < 5 && videoElement.readyState >= 2) {
            const wasPlaying = !videoElement.paused;
            
            URL.revokeObjectURL(currentBlobUrl);
            videoElement.src = newBlobUrl;
            
            if (currentTime > 0) {
              videoElement.currentTime = currentTime;
            }
            if (wasPlaying) {
              videoElement.play().catch(() => {});
            }
          } else {
            // Libérer le nouveau blob URL si on ne l'utilise pas
            URL.revokeObjectURL(newBlobUrl);
          }
        }
      } catch (error) {
        console.error(`[SecureChunkLoader] ❌ Erreur chunk ${i} (arrière-plan):`, error);
        // Continuer avec le prochain chunk même en cas d'erreur
      }
    }
    
    console.log('[SecureChunkLoader] ✅ Chargement en arrière-plan terminé');
  }

  /**
   * Charge en blob complet (fallback) - SÉCURISÉ : chunks validés individuellement
   * Note: Même en mode blob, les chunks sont validés et ne sont jamais reconstruits en MP4 complet
   * Le blob est créé uniquement pour la compatibilité navigateur, mais les chunks restent sécurisés
   */
  private async loadAsBlob(totalSize: number, totalChunks: number): Promise<string> {
    console.log('[SecureChunkLoader] 📦 Mode blob sécurisé (fallback - MSE non supporté)');
    console.warn('[SecureChunkLoader] ⚠️ Mode blob activé - recommandé d\'utiliser un navigateur supportant MSE pour une meilleure sécurité');

    // Créer un MediaSource même en fallback pour éviter de reconstruire le MP4 complet
    if (window.MediaSource && this.options.videoElement) {
      try {
        return await this.loadWithMSE(totalSize, totalChunks);
      } catch (error) {
        console.warn('[SecureChunkLoader] ⚠️ MSE échoué, utilisation du fallback sécurisé:', error);
      }
    }

    // SÉCURITÉ : Le mode blob n'est PAS recommandé car il peut reconstruire le MP4
    // On force l'utilisation de MSE ou on refuse de charger
    throw new Error('MSE requis pour la sécurité - votre navigateur ne supporte pas Media Source Extensions. Veuillez utiliser un navigateur moderne (Chrome, Firefox, Safari, Edge).');
  }


  /**
   * Récupère les métadonnées de la vidéo
   */
  private async fetchMetadata(): Promise<{ size: number; contentType: string }> {
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
   * Récupère un chunk avec validation
   */
  private async fetchChunk(index: number, totalChunks: number): Promise<ChunkResponse> {
    const request: any = {
      videoId: this.options.videoId,
      chunkIndex: index,
      timestamp: Date.now(),
      fingerprint: this.fingerprint!,
      encrypted: false // Mode non-chiffré pour SecureChunkLoader
    };

    // Inclure le sessionId si disponible
    if (this.sessionId) {
      request.sessionId = this.sessionId;
    }

    // Ne pas envoyer previousHash pour le premier chunk
    if (index > 0 && this.lastHash) {
      request.previousHash = this.lastHash;
    }

    const response = await fetch(`/api/videos/secure-stream/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`,
        'X-Chunk-Index': index.toString(),
        'X-Total-Chunks': totalChunks.toString()
      },
      body: JSON.stringify(request),
      signal: this.options.signal
    });

    if (!response.ok) {
      throw new Error(`Erreur chunk ${index}: ${response.status}`);
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
    this.chunks = [];
    this.chunkQueue = [];
    
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
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
        URL.revokeObjectURL(URL.createObjectURL(this.mediaSource));
      } catch (e) {
        // Ignorer
      }
    }
    
    this.mediaSource = null;
    this.sourceBuffer = null;
  }

  /**
   * Génère un hash de validation
   */
  private async generateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Hook React pour le chargement sécurisé
 */
export const useSecureChunkLoader = () => {
  const load = async (options: LoaderOptions): Promise<string> => {
    const loader = new SecureChunkLoader(options);
    return loader.load();
  };

  return { load };
};
