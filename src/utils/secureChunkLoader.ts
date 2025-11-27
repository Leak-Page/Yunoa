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
    // NOTE: HLS désactivé car nécessite une conversion préalable des vidéos en format HLS (.ts)
    // Les vidéos MP4 brutes ne peuvent pas être servies comme segments HLS
    // Utiliser directement le système obfusqué qui fonctionne avec MP4
    console.log('[SecureChunkLoader] 🚀 Utilisation du système de streaming obfusqué (HLS nécessite conversion préalable)');
    
    // Utiliser directement le système obfusqué
    const { ObfuscatedStreamLoader } = await import('@/utils/obfuscatedStreamLoader');
    
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
        this.options.onError?.(error);
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
