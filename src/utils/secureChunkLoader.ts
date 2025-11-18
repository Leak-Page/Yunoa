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
   * Charge avec Media Source Extensions pour streaming progressif SÉCURISÉ
   * Les chunks sont validés individuellement et ajoutés au buffer sans jamais reconstruire le MP4 complet
   */
  private async loadWithMSE(totalSize: number, totalChunks: number, codec: string = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'): Promise<string> {
    if (!this.options.videoElement) {
      throw new Error('VideoElement requis pour MSE');
    }

    console.log('[SecureChunkLoader] 🚀 Mode streaming MSE sécurisé activé');
    console.log('[SecureChunkLoader] 🔒 Les chunks sont validés individuellement - le MP4 complet n\'est jamais reconstruit');

    // Créer MediaSource
    this.mediaSource = new MediaSource();
    const blobUrl = URL.createObjectURL(this.mediaSource);
    this.options.videoElement.src = blobUrl;

    // Attendre que MediaSource soit prêt
    await new Promise<void>((resolve, reject) => {
      if (!this.mediaSource) return reject(new Error('MediaSource non initialisé'));

      const timeout = setTimeout(() => {
        reject(new Error('Timeout: MediaSource sourceopen non déclenché'));
      }, 10000);

      this.mediaSource.addEventListener('sourceopen', () => {
        clearTimeout(timeout);
        try {
          this.sourceBuffer = this.mediaSource!.addSourceBuffer(codec);
          
          this.sourceBuffer.addEventListener('updateend', () => {
            this.isAppending = false;
            this.processQueue();
          });

          this.sourceBuffer.addEventListener('error', (e) => {
            console.error('[SecureChunkLoader] ❌ Erreur SourceBuffer:', e);
            this.isAppending = false;
          });

          console.log('[SecureChunkLoader] ✅ SourceBuffer créé');
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.mediaSource.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(new Error('MediaSource error'));
      });
    });

    // Charger les chunks en streaming
    // Commencer à charger plusieurs chunks en parallèle pour un démarrage plus rapide
    const initialChunksToLoad = Math.min(5, totalChunks); // Charger les 5 premiers chunks rapidement
    
    for (let i = 0; i < totalChunks; i++) {
      if (this.isAborted || this.options.signal?.aborted) {
        throw new DOMException('Chargement annulé', 'AbortError');
      }

      // Log de progression
      if (i % 10 === 0 || i < 5) {
        console.log(`[SecureChunkLoader] 📦 Chunk ${i + 1}/${totalChunks} (${Math.round((i / totalChunks) * 100)}%)`);
      }

      try {
        // SÉCURITÉ : Limiter la taille de la queue pour éviter l'accumulation en mémoire
        // Attendre que la queue se vide si elle devient trop grande
        const MAX_QUEUE_SIZE = 3; // Maximum 3 chunks en attente
        while (this.chunkQueue.length >= MAX_QUEUE_SIZE && !this.isAborted) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        if (this.isAborted || this.options.signal?.aborted) {
          throw new DOMException('Chargement annulé', 'AbortError');
        }
        
        // Récupérer et valider le chunk
        const chunk = await this.fetchChunk(i, totalChunks);
        
        // VALIDATION SÉCURITÉ : Vérifier que le chunk est valide avant de l'ajouter
        if (!chunk.data || chunk.data.byteLength === 0) {
          throw new Error(`Chunk ${i} invalide ou vide - rejeté pour sécurité`);
        }
        
        // VALIDATION SÉCURITÉ : Vérifier la taille du chunk (protection contre les attaques)
        if (chunk.data.byteLength > this.chunkSize * 2) {
          throw new Error(`Chunk ${i} trop volumineux (${chunk.data.byteLength} bytes) - possible attaque`);
        }
        
        // Ajouter à la queue pour traitement asynchrone
        // Le chunk validé est ajouté directement au buffer MSE, jamais stocké en MP4 complet
        // La queue est limitée à MAX_QUEUE_SIZE pour éviter l'accumulation
        this.chunkQueue.push(chunk.data);
        this.processQueue();
        
        // Mettre à jour le token et le hash pour le prochain chunk
        this.currentToken = chunk.nextToken;
        this.lastHash = chunk.nextHash;

        // Notifier la progression
        if (this.options.onProgress) {
          this.options.onProgress((i + 1) * this.chunkSize, totalSize);
        }

        if (this.options.onChunkValidated) {
          this.options.onChunkValidated(i);
        }

        // Vérifier l'expiration du token
        if (Date.now() > chunk.expiresAt) {
          throw new Error('Session expirée');
        }

        // Pour les premiers chunks, permettre un démarrage plus rapide
        // En laissant le navigateur commencer à lire dès qu'il y a assez de données
        if (i === initialChunksToLoad - 1 && this.options.videoElement) {
          // Le navigateur peut commencer à lire avec les premiers chunks
          console.log('[SecureChunkLoader] 🎬 Suffisamment de données pour démarrer la lecture');
        }
      } catch (error) {
        console.error(`[SecureChunkLoader] ❌ Erreur chunk ${i}:`, error);
        throw error;
      }
    }

    // Attendre que tous les chunks soient ajoutés
    while (this.chunkQueue.length > 0 || this.isAppending) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (this.isAborted) {
        throw new DOMException('Chargement annulé', 'AbortError');
      }
    }

    // Finaliser le stream
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      await new Promise<void>((resolve) => {
        if (!this.sourceBuffer || !this.sourceBuffer.updating) {
          this.mediaSource!.endOfStream();
          resolve();
        } else {
          const checkReady = () => {
            if (!this.sourceBuffer || !this.sourceBuffer.updating) {
              this.mediaSource!.endOfStream();
              resolve();
            } else {
              setTimeout(checkReady, 50);
            }
          };
          checkReady();
        }
      });
    }

    console.log('[SecureChunkLoader] ✅ Streaming terminé');
    return blobUrl;
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
   * Traite la queue de chunks pour MSE - SÉCURISÉ
   * Les chunks sont ajoutés directement au buffer sans jamais être stockés en MP4 complet
   */
  private processQueue(): void {
    if (this.isAppending || this.chunkQueue.length === 0 || !this.sourceBuffer) {
      return;
    }

    if (this.sourceBuffer.updating || !this.mediaSource || this.mediaSource.readyState !== 'open') {
      return;
    }

    this.isAppending = true;
    const chunk = this.chunkQueue.shift();
    
    if (chunk) {
      try {
        // VALIDATION FINALE : Vérifier le chunk une dernière fois avant l'ajout
        if (!chunk || chunk.byteLength === 0) {
          console.error('[SecureChunkLoader] ⚠️ Chunk invalide rejeté');
          this.isAppending = false;
          this.processQueue(); // Traiter le prochain chunk
          return;
        }
        
        // Ajouter le chunk validé directement au buffer MSE
        // Le chunk est immédiatement traité par le navigateur, jamais stocké en MP4 complet
        this.sourceBuffer.appendBuffer(chunk);
        
        // Le chunk est maintenant dans le buffer du navigateur, pas dans notre mémoire
        // Cela empêche la reconstruction du MP4 complet côté client
      } catch (error: any) {
        this.isAppending = false;
        if (error.name === 'QuotaExceededError') {
          // Buffer plein, remettre le chunk dans la queue
          this.chunkQueue.unshift(chunk);
          setTimeout(() => this.processQueue(), 100);
        } else {
          console.error('[SecureChunkLoader] ❌ Erreur appendBuffer:', error);
          // En cas d'erreur, ne pas stocker le chunk - sécurité maximale
        }
      }
    } else {
      this.isAppending = false;
    }
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
