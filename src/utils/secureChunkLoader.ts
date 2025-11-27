/**
 * Système de chargement sécurisé avec HLS
 * Utilise HLS en priorité, avec fallback sur streaming obfusqué
 * Architecture: HLS → API → token → playlist → segments
 */

interface LoaderOptions {
  videoUrl: string;
  videoId: string;
  sessionToken: string;
  videoElement?: HTMLVideoElement;
  onProgress?: (loaded: number, total: number) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export class SecureChunkLoader {
  private currentToken: string;
  private isAborted = false;
  private hlsPlayer: any = null;
  private obfuscatedLoader: any = null;

  constructor(private options: LoaderOptions) {
    this.currentToken = options.sessionToken;
  }

  /**
   * Charge la vidéo en streaming optimisé et obfusqué
   * Utilise HLS si disponible, sinon fallback sur le système obfusqué
   */
  async load(): Promise<string> {
    // Essayer d'utiliser HLS en premier (plus sécurisé)
    try {
      const { HLSPlayer } = await import('@/utils/hlsPlayer');
      
      // Obtenir la playlist HLS
      const response = await fetch('/api/videos/hls/playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.currentToken}`
      },
      body: JSON.stringify({
          videoId: this.options.videoId
      }),
      signal: this.options.signal
    });

      if (response.ok) {
        const data = await response.json();
        const hlsPlayer = new HLSPlayer({
          videoElement: this.options.videoElement!,
          playlistUrl: data.playlistUrl,
          sessionToken: this.currentToken,
          onProgress: (progress) => {
            if (this.options.onProgress) {
              // Convertir le pourcentage en bytes approximatifs
              this.options.onProgress(progress, 100);
            }
          },
          onError: (error) => {
            console.error('[SecureChunkLoader] ❌ Erreur HLS:', error);
          }
        });

        await hlsPlayer.load();
        this.hlsPlayer = hlsPlayer;
        
        console.log('[SecureChunkLoader] 🚀 Utilisation du système HLS sécurisé');
        return data.playlistUrl;
      }
    } catch (error) {
      console.warn('[SecureChunkLoader] ⚠️ HLS non disponible, utilisation du fallback');
    }

    // Fallback sur le système obfusqué
    const { ObfuscatedStreamLoader } = await import('@/utils/obfuscatedStreamLoader');
    
    console.log('[SecureChunkLoader] 🚀 Utilisation du système de streaming obfusqué optimisé');
    
    const obfuscatedLoader = new ObfuscatedStreamLoader({
      videoUrl: this.options.videoUrl,
      videoId: this.options.videoId,
      sessionToken: this.currentToken,
      videoElement: this.options.videoElement,
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

    // Stocker le loader pour le cleanup
    this.obfuscatedLoader = obfuscatedLoader;

    return await obfuscatedLoader.load();
  }

  /**
   * Annule le chargement
   */
  abort(): void {
    this.isAborted = true;
    
    if (this.hlsPlayer) {
      this.hlsPlayer.cleanup();
    }
    
    if (this.obfuscatedLoader) {
      this.obfuscatedLoader.abort();
    }
  }

  /**
   * Nettoie les ressources
   * SÉCURITÉ : Supprime tous les chunks et révoque les blobs pour empêcher le téléchargement
   */
  cleanup(): void {
    this.abort();
    
    if (this.hlsPlayer) {
      this.hlsPlayer.cleanup();
      this.hlsPlayer = null;
    }
    
    if (this.obfuscatedLoader) {
      this.obfuscatedLoader.cleanup();
      this.obfuscatedLoader = null;
    }
    
    console.log('[SecureChunkLoader] 🧹 Ressources nettoyées - sécurité maximale');
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
