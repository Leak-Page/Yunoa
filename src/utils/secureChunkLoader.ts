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

  constructor(private options: LoaderOptions) {
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo en micro-chunks avec validation continue
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
    console.log(`[SecureChunkLoader] 📦 Chargement de ${totalChunks} chunks (${Math.round(metadata.size / 1024 / 1024)} MB)`);
    
    // Charger chaque chunk avec validation
    for (let i = 0; i < totalChunks; i++) {
      if (this.isAborted || this.options.signal?.aborted) {
        throw new DOMException('Chargement annulé', 'AbortError');
      }

      // Log de progression tous les 10 chunks ou pour les 5 premiers
      if (i % 10 === 0 || i < 5) {
        console.log(`[SecureChunkLoader] 📦 Chunk ${i + 1}/${totalChunks} (${Math.round((i / totalChunks) * 100)}%)`);
      }

      try {
        const chunk = await this.fetchChunk(i, totalChunks);
        this.chunks.push(chunk.data);
        
        // Mettre à jour le token et le hash pour le prochain chunk
        this.currentToken = chunk.nextToken;
        this.lastHash = chunk.nextHash;

        // Notifier la progression
        if (this.options.onProgress) {
          this.options.onProgress((i + 1) * this.chunkSize, metadata.size);
        }

        if (this.options.onChunkValidated) {
          this.options.onChunkValidated(i);
        }

        // Vérifier l'expiration du token
        if (Date.now() > chunk.expiresAt) {
          throw new Error('Session expirée');
        }
      } catch (error) {
        console.error(`[SecureChunkLoader] ❌ Erreur chunk ${i}:`, error);
        throw error;
      }
    }

    // Créer le blob final
    const blob = new Blob(this.chunks, { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    // Nettoyer
    this.chunks = [];

    return blobUrl;
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
