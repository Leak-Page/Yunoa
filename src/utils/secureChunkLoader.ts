import { clientFingerprint } from './clientFingerprint';
import { StreamingMSELoader } from './streamingMSELoader';

/**
 * Système de chargement par micro-chunks avec validation continue
 * Utilise le nouveau StreamingMSELoader pour un streaming optimal
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
  private chunkSize = 1024 * 1024; // 1MB par chunk pour un chargement plus rapide
  private currentToken: string;
  private fingerprint: string | null = null;
  private lastHash: string | null = null;
  private sessionId: string | null = null;
  private chunks: BlobPart[] = [];
  private isAborted = false;
  private mseLoader: StreamingMSELoader | null = null;

  constructor(private options: LoaderOptions) {
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo en streaming progressif avec MSE (nouveau système optimisé)
   */
  async load(): Promise<string> {
    // Générer l'empreinte du client
    this.fingerprint = await clientFingerprint.generate();

    if (!this.fingerprint) {
      throw new Error('Impossible de générer l\'empreinte du client');
    }

    // TOUJOURS utiliser MSE si disponible pour la sécurité maximale et les performances
    if (this.options.videoElement && window.MediaSource) {
      console.log('[SecureChunkLoader] 🚀 Utilisation du nouveau système de streaming MSE optimisé');
      
      // Utiliser le nouveau StreamingMSELoader
      this.mseLoader = new StreamingMSELoader({
        videoUrl: this.options.videoUrl,
        videoId: this.options.videoId,
        sessionToken: this.currentToken,
        videoElement: this.options.videoElement,
        chunkSize: this.chunkSize,
        onProgress: (loaded, total) => {
          if (this.options.onProgress) {
            this.options.onProgress(loaded, total);
          }
        },
        onError: (error) => {
          console.error('[SecureChunkLoader] ❌ Erreur:', error);
        },
        signal: this.options.signal
      });

      return await this.mseLoader.load();
    }
    
    // Fallback sécurisé uniquement si MSE n'est vraiment pas disponible
    console.warn('[SecureChunkLoader] ⚠️ MSE non disponible, utilisation du fallback sécurisé');
    throw new Error('Media Source Extensions requis pour la sécurité - veuillez utiliser un navigateur moderne');
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
    
    if (this.mseLoader) {
      this.mseLoader.abort();
    }
  }

  /**
   * Nettoie les ressources
   * SÉCURITÉ : Supprime tous les chunks et révoque les blobs pour empêcher le téléchargement
   */
  cleanup(): void {
    this.abort();
    
    // SÉCURITÉ : Nettoyer tous les chunks en mémoire
    // Empêche la reconstruction du MP4 complet
    this.chunks = [];
    
    if (this.mseLoader) {
      this.mseLoader.cleanup();
      this.mseLoader = null;
    }
    
    console.log('[SecureChunkLoader] 🧹 Tous les chunks nettoyés - sécurité maximale');
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
