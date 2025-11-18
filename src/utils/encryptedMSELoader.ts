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
  private updateEndPromise: Promise<void> | null = null;
  private updateEndResolve: (() => void) | null = null;

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
        console.log('[MSE] ✅ Token initial reçu et stocké');
      } else {
        throw new Error('Token initial manquant dans les métadonnées');
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
            
            // Créer une promesse pour attendre la fin de l'update
            this.updateEndPromise = new Promise<void>((resolve) => {
              this.updateEndResolve = resolve;
            });
            
            this.sourceBuffer.addEventListener('updateend', () => {
              // Libérer le verrou d'append une fois l'opération terminée
              this.isAppending = false;
              if (this.updateEndResolve) {
                this.updateEndResolve();
                this.updateEndResolve = null;
                this.updateEndPromise = null;
              }
              // Traiter la queue après chaque append
              this.processQueue();
            });

            this.sourceBuffer.addEventListener('error', (e) => {
              console.error('[MSE] ❌ Erreur SourceBuffer:', e);
              this.isAppending = false;
              if (this.updateEndResolve) {
                this.updateEndResolve();
                this.updateEndResolve = null;
                this.updateEndPromise = null;
              }
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
      console.log('[MSE] 📋 Informations de session:', {
        videoId: this.options.videoId,
        fingerprint: this.fingerprint?.substring(0, 16) + '...',
        hasToken: !!this.currentToken,
        tokenLength: this.currentToken?.length
      });
      
      // Commencer le streaming immédiatement pour éviter l'expiration du token
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

      // Attendre que le buffer ait de l'espace avant de télécharger le prochain chunk
      // Limiter la queue à 5 chunks pour éviter de surcharger la mémoire
      while (this.chunkQueue.length >= 5) {
        await this.waitForBufferSpace();
        if (this.isAborted) {
          throw new DOMException('Streaming annulé', 'AbortError');
        }
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

    // Attendre que tous les chunks soient ajoutés au buffer
    console.log('[MSE] ⏳ Attente de la fin du traitement de la queue...');
    while (this.chunkQueue.length > 0 || this.isAppending) {
      await this.waitForBufferSpace();
      if (this.isAborted) {
        throw new DOMException('Streaming annulé', 'AbortError');
      }
    }

    console.log('[MSE] ✅ Tous les chunks streamés, finalisation...');
    
    // Finaliser le stream
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      await new Promise<void>((resolve) => {
        if (!this.sourceBuffer || this.sourceBuffer.updating) {
          // Attendre que le buffer soit prêt
          const checkReady = () => {
            if (!this.sourceBuffer || !this.sourceBuffer.updating) {
              resolve();
            } else {
              setTimeout(checkReady, 50);
            }
          };
          checkReady();
        } else {
          resolve();
        }
      });
      
      this.mediaSource.endOfStream();
      console.log('[MSE] ✅ Stream finalisé');
    }
  }

  /**
   * Attendre que le buffer ait de l'espace
   */
  private async waitForBufferSpace(): Promise<void> {
    if (!this.sourceBuffer) {
      return;
    }

    // Si le buffer est en train d'être mis à jour, attendre
    if (this.sourceBuffer.updating || this.isAppending) {
      if (this.updateEndPromise) {
        await this.updateEndPromise;
      } else {
        // Si aucune promesse n'existe mais que le buffer est en train d'être mis à jour,
        // attendre que l'opération se termine
        await new Promise<void>((resolve) => {
          const checkReady = () => {
            if (!this.sourceBuffer || (!this.sourceBuffer.updating && !this.isAppending)) {
              resolve();
            } else {
              setTimeout(checkReady, 50);
            }
          };
          checkReady();
        });
      }
    }

    // Vérifier si le buffer est plein (QuotaExceededError)
    // Si c'est le cas, attendre un peu et réessayer
    if (this.sourceBuffer.buffered.length > 0) {
      const bufferedEnd = this.sourceBuffer.buffered.end(this.sourceBuffer.buffered.length - 1);
      const videoElement = this.options.videoElement;
      if (videoElement && videoElement.currentTime > 0) {
        // Si le buffer est trop en avance, attendre un peu
        const bufferAhead = bufferedEnd - videoElement.currentTime;
        if (bufferAhead > 30) { // Plus de 30 secondes d'avance
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }

  /**
   * Récupérer un chunk chiffré
   */
  private async fetchEncryptedChunk(
    index: number, 
    totalChunks: number
  ): Promise<EncryptedChunkResponse> {
    // Pour le chunk 0, ne pas envoyer previousHash
    const requestBody: any = {
      videoId: this.options.videoId,
      chunkIndex: index,
      timestamp: Date.now(),
      fingerprint: this.fingerprint!,
      encrypted: true
    };

    // Ne pas envoyer previousHash pour le premier chunk
    if (index > 0 && this.lastHash) {
      requestBody.previousHash = this.lastHash;
    }

    console.log(`[MSE] 📡 Requête chunk ${index}/${totalChunks}`, {
      hasToken: !!this.currentToken,
      hasPreviousHash: index > 0 && !!this.lastHash,
      tokenPreview: this.currentToken?.substring(0, 20) + '...'
    });

    const response = await fetch(`/api/videos/secure-stream/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`,
        'X-Chunk-Index': index.toString(),
        'X-Total-Chunks': totalChunks.toString()
      },
      body: JSON.stringify(requestBody),
      signal: this.options.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MSE] ❌ Erreur chunk ${index}:`, response.status, errorText);
      
      // Essayer de parser l'erreur pour plus de détails
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.code === 'INVALID_SEQUENCE') {
          throw new Error(`Séquence invalide: le serveur attend le chunk ${index} mais la session n'est pas synchronisée. Veuillez recharger la page.`);
        }
        throw new Error(`Erreur chunk ${index}: ${response.status} - ${errorData.error || errorText}`);
      } catch (parseError) {
        throw new Error(`Erreur chunk ${index}: ${response.status} - ${errorText}`);
      }
    }

    const result = await response.json();
    console.log(`[MSE] ✅ Chunk ${index} reçu`, {
      hasNextToken: !!result.nextToken,
      hasNextHash: !!result.nextHash
    });

    return result;
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

    // Vérifier si le MediaSource est toujours ouvert
    if (!this.mediaSource || this.mediaSource.readyState !== 'open') {
      console.warn('[MSE] ⚠️ MediaSource n\'est plus ouvert');
      return;
    }

    this.isAppending = true;
    const chunk = this.chunkQueue.shift();
    
    if (chunk) {
      try {
        // Créer une nouvelle promesse pour attendre la fin de cet append
        this.updateEndPromise = new Promise<void>((resolve) => {
          this.updateEndResolve = resolve;
        });
        
        this.sourceBuffer.appendBuffer(chunk);
      } catch (error: any) {
        this.isAppending = false;
        console.error('[MSE] ❌ Erreur appendBuffer:', error);
        
        // Gérer le cas où le buffer est plein
        if (error.name === 'QuotaExceededError') {
          console.warn('[MSE] ⚠️ Buffer plein, remise du chunk dans la queue');
          // Remettre le chunk dans la queue
          if (chunk) {
            this.chunkQueue.unshift(chunk);
          }
          // Attendre un peu avant de réessayer
          setTimeout(() => {
            this.processQueue();
          }, 100);
        } else {
          if (this.options.onError) {
            this.options.onError(error as Error);
          }
        }
        
        if (this.updateEndResolve) {
          this.updateEndResolve();
          this.updateEndResolve = null;
          this.updateEndPromise = null;
        }
      }
    } else {
      this.isAppending = false;
    }
  }

  /**
   * Arrêter le streaming
   */
  abort(): void {
    this.isAborted = true;
    this.chunkQueue = [];
    this.isAppending = false;
    
    if (this.updateEndResolve) {
      this.updateEndResolve();
      this.updateEndResolve = null;
      this.updateEndPromise = null;
    }
    
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
