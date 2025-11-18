import { clientFingerprint } from './clientFingerprint';

/**
 * Système de streaming chiffré avec Media Source Extensions
 * Empêche le téléchargement direct en ne reconstruisant jamais le MP4 complet
 */

interface EncryptedChunkResponse {
  data: string; // Base64 encrypted data
  iv: string; // Initialization vector
  nextToken: string;
  nextHash: string;
  expiresAt: number;
}

interface MSELoaderOptions {
  videoId: string;
  sessionToken: string;
  videoElement: HTMLVideoElement;
  onProgress?: (loaded: number, total: number) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export class EncryptedMSELoader {
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private chunkSize = 512 * 1024; // 512 KB par chunk
  private currentToken: string;
  private fingerprint: string | null = null;
  private lastHash: string | null = null;
  private isAborted = false;
  private encryptionKey: CryptoKey | null = null;
  private chunkQueue: ArrayBuffer[] = [];
  private isAppending = false;

  constructor(private options: MSELoaderOptions) {
    this.currentToken = options.sessionToken;
  }

  /**
   * Initialise et démarre le streaming MSE
   */
  async initialize(): Promise<void> {
    try {
      console.log('[MSE] 🚀 Initialisation du streaming chiffré...');
      
      // Générer l'empreinte
      this.fingerprint = await clientFingerprint.generate();
      if (!this.fingerprint) {
        throw new Error('Impossible de générer l\'empreinte');
      }
      console.log('[MSE] ✅ Empreinte générée:', this.fingerprint.substring(0, 16) + '...');

      // Obtenir les métadonnées et la clé de chiffrement
      console.log('[MSE] 📡 Récupération des métadonnées...');
      const metadata = await this.fetchMetadata();
      console.log('[MSE] ✅ Métadonnées reçues:', { 
        totalChunks: metadata.totalChunks, 
        size: Math.round(metadata.size / 1024 / 1024) + ' MB' 
      });

      // Utiliser le token éphémère initial renvoyé par le serveur pour le premier chunk
      if ((metadata as any).initialToken) {
        this.currentToken = (metadata as any).initialToken;
        console.log('[MSE] ✅ Token initial reçu');
      }
      
      // Dériver la clé de déchiffrement
      await this.deriveDecryptionKey(metadata.encryptionSeed);
      console.log('[MSE] 🔐 Clé de déchiffrement dérivée');

      // Vérifier le support MSE
      if (!window.MediaSource) {
        throw new Error('Media Source Extensions non supporté par ce navigateur');
      }

      // Initialiser Media Source
      this.mediaSource = new MediaSource();
      this.options.videoElement.src = URL.createObjectURL(this.mediaSource);
      console.log('[MSE] 📺 MediaSource créé, en attente de sourceopen...');

      // Attendre que MediaSource soit prêt
      await new Promise<void>((resolve, reject) => {
        if (!this.mediaSource) return reject(new Error('MediaSource not initialized'));
        
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: MediaSource sourceopen non déclenché après 10s'));
        }, 10000);

        this.mediaSource.addEventListener('sourceopen', () => {
          try {
            clearTimeout(timeout);
            if (!this.mediaSource) throw new Error('MediaSource not available');
            
            console.log('[MSE] ✅ MediaSource ouvert, création du SourceBuffer...');
            
            // Vérifier le codec supporté
            const codec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
            if (!MediaSource.isTypeSupported(codec)) {
              console.warn('[MSE] ⚠️ Codec non supporté:', codec);
              throw new Error(`Codec non supporté: ${codec}`);
            }
            
            // Créer le source buffer
            this.sourceBuffer = this.mediaSource.addSourceBuffer(codec);
            console.log('[MSE] ✅ SourceBuffer créé avec codec:', codec);
            
            this.sourceBuffer.addEventListener('updateend', () => {
              // Libérer le verrou d'append une fois l'opération terminée
              this.isAppending = false;
              this.processQueue();
            });

            this.sourceBuffer.addEventListener('error', (e) => {
              console.error('[MSE] ❌ Erreur SourceBuffer:', e);
            });

            resolve();
          } catch (error) {
            clearTimeout(timeout);
            console.error('[MSE] ❌ Erreur lors de sourceopen:', error);
            reject(error);
          }
        });

        this.mediaSource.addEventListener('error', (e) => {
          clearTimeout(timeout);
          console.error('[MSE] ❌ Erreur MediaSource:', e);
          reject(new Error('MediaSource error: ' + e));
        });
      });

      console.log('[MSE] 🎬 Démarrage du streaming des chunks...');
      // Commencer le streaming
      await this.streamChunks(metadata.totalChunks);

    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error as Error);
      }
      throw error;
    }
  }

  /**
   * Obtenir les métadonnées du streaming
   */
  private async fetchMetadata(): Promise<{ 
    size: number; 
    totalChunks: number; 
    encryptionSeed: string;
    initialToken?: string;
  }> {
    const response = await fetch(`/api/videos/secure-stream/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`
      },
      body: JSON.stringify({
        videoId: this.options.videoId,
        fingerprint: this.fingerprint,
        useMSE: true
      }),
      signal: this.options.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MSE] ❌ Erreur metadata:', response.status, errorText);
      throw new Error(`Erreur métadonnées: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Dériver la clé de déchiffrement
   */
  private async deriveDecryptionKey(seed: string): Promise<void> {
    const encoder = new TextEncoder();
    // Aligner avec le serveur: clé = SHA-256(encryptionSeed + fingerprint)
    const data = encoder.encode(seed + this.fingerprint);
    const digest = await crypto.subtle.digest('SHA-256', data);
    this.encryptionKey = await crypto.subtle.importKey(
      'raw',
      digest,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  /**
   * Streamer tous les chunks
   */
  private async streamChunks(totalChunks: number): Promise<void> {
    console.log(`[MSE] 📦 Streaming de ${totalChunks} chunks...`);
    
    for (let i = 0; i < totalChunks; i++) {
      if (this.isAborted || this.options.signal?.aborted) {
        throw new DOMException('Streaming annulé', 'AbortError');
      }

      if (i % 10 === 0 || i < 5) {
        console.log(`[MSE] 📦 Chunk ${i + 1}/${totalChunks} (${Math.round((i / totalChunks) * 100)}%)`);
      }

      const encryptedChunk = await this.fetchEncryptedChunk(i, totalChunks);
      const decryptedChunk = await this.decryptChunk(encryptedChunk);

      // Ajouter à la queue
      this.chunkQueue.push(decryptedChunk);
      this.processQueue();

      // Mettre à jour le token et le hash
      this.currentToken = encryptedChunk.nextToken;
      this.lastHash = encryptedChunk.nextHash;

      // Notifier la progression
      if (this.options.onProgress) {
        this.options.onProgress((i + 1) * this.chunkSize, totalChunks * this.chunkSize);
      }

      // Vérifier l'expiration
      if (Date.now() > encryptedChunk.expiresAt) {
        throw new Error('Session expirée');
      }
    }

    console.log('[MSE] ✅ Tous les chunks streamés, finalisation...');
    
    // Finaliser le stream
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.mediaSource.endOfStream();
      console.log('[MSE] ✅ Stream finalisé');
    }
  }

  /**
   * Récupérer un chunk chiffré
   */
  private async fetchEncryptedChunk(
    index: number, 
    totalChunks: number
  ): Promise<EncryptedChunkResponse> {
    const response = await fetch(`/api/videos/secure-stream/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`,
        'X-Chunk-Index': index.toString(),
        'X-Total-Chunks': totalChunks.toString()
      },
      body: JSON.stringify({
        videoId: this.options.videoId,
        chunkIndex: index,
        timestamp: Date.now(),
        fingerprint: this.fingerprint!,
        previousHash: this.lastHash || undefined,
        encrypted: true
      }),
      signal: this.options.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MSE] ❌ Erreur chunk ${index}:`, response.status, errorText);
      throw new Error(`Erreur chunk ${index}: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Déchiffrer un chunk
   */
  private async decryptChunk(encryptedChunk: EncryptedChunkResponse): Promise<ArrayBuffer> {
    if (!this.encryptionKey) {
      throw new Error('Clé de déchiffrement non disponible');
    }

    // Décoder le base64
    const encryptedData = Uint8Array.from(atob(encryptedChunk.data), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedChunk.iv), c => c.charCodeAt(0));

    // Déchiffrer
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.encryptionKey,
      encryptedData
    );

    return decrypted;
  }

  /**
   * Traiter la queue de chunks
   */
  private processQueue(): void {
    if (this.isAppending || this.chunkQueue.length === 0) {
      return;
    }

    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      return;
    }

    this.isAppending = true;
    const chunk = this.chunkQueue.shift();
    
    if (chunk) {
      try {
        this.sourceBuffer.appendBuffer(chunk);
      } catch (error) {
        console.error('Erreur appendBuffer:', error);
        if (this.options.onError) {
          this.options.onError(error as Error);
        }
      }
    }
    
    this.isAppending = false;
  }

  /**
   * Arrêter le streaming
   */
  abort(): void {
    this.isAborted = true;
    this.chunkQueue = [];
    
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        this.mediaSource.endOfStream();
      } catch (e) {
        console.error('Erreur endOfStream:', e);
      }
    }
  }

  /**
   * Nettoyer les ressources
   */
  cleanup(): void {
    this.abort();
    
    if (this.options.videoElement.src) {
      URL.revokeObjectURL(this.options.videoElement.src);
      this.options.videoElement.src = '';
    }
    
    this.sourceBuffer = null;
    this.mediaSource = null;
    this.encryptionKey = null;
  }
}
