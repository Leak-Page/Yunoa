import { useState, useEffect } from 'react';
import { SecureChunkLoader } from './secureChunkLoader';
import { clientFingerprint } from './clientFingerprint';

/**
 * Utilitaires pour la sécurité des vidéos
 * - Chargement sécurisé via proxy avec validation continue
 * - Conversion en blob avec fingerprinting
 * - Protection anti-inspection et anti-téléchargement
 * - Système de micro-chunks pour empêcher les extensions
 */

interface VideoSecurityConfig {
  apiBaseUrl?: string;
  authToken?: string;
  maxRetries?: number;
  retryDelay?: number;
}

interface VideoLoadOptions {
  videoUrl: string;
  videoId: string;
  sessionToken: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export class VideoSecurityManager {
  private config: VideoSecurityConfig;
  private blobCache = new Map<string, string>();

  constructor(config: VideoSecurityConfig = {}) {
    this.config = {
      apiBaseUrl: '/api',
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Charge une vidéo via le système de micro-chunks sécurisé
   * Empêche le téléchargement par extensions grâce à la validation continue
   */
  async loadSecureVideo(options: VideoLoadOptions): Promise<string> {
    const { videoUrl, videoId, sessionToken, onProgress, signal } = options;
    
    // Clé de cache basée sur l'URL et l'ID
    const cacheKey = `${videoId}-${this.hashString(videoUrl)}`;
    
    // Vérifier le cache
    if (this.blobCache.has(cacheKey)) {
      return this.blobCache.get(cacheKey)!;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        if (signal?.aborted) {
          throw new DOMException('Chargement annulé', 'AbortError');
        }

        // Utiliser le système de micro-chunks avec validation continue
        const loader = new SecureChunkLoader({
          videoUrl,
          videoId,
          sessionToken,
          onProgress: (loaded, total) => {
            if (onProgress && total > 0) {
              onProgress((loaded / total) * 100);
            }
          },
          onChunkValidated: (index) => {
            console.log(`🔒 Chunk ${index} validé`);
          },
          signal
        });

        const blobUrl = await loader.load();

        // Mettre en cache
        this.blobCache.set(cacheKey, blobUrl);

        // Log sécurisé sans exposer d'informations sensibles
        console.log('✅ Vidéo chargée avec validation continue');

        return blobUrl;

      } catch (error) {
        lastError = error as Error;
        console.error(`Tentative ${attempt + 1} échouée:`, error.message);

        if (attempt < this.config.maxRetries! - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay! * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Échec du chargement après plusieurs tentatives');
  }

  /**
   * Libère les ressources blob du cache
   */
  cleanup(): void {
    for (const blobUrl of this.blobCache.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.blobCache.clear();
  }

  /**
   * Libère une ressource blob spécifique
   */
  releaseBlobUrl(blobUrl: string): void {
    URL.revokeObjectURL(blobUrl);
    // Retirer du cache
    for (const [key, url] of this.blobCache.entries()) {
      if (url === blobUrl) {
        this.blobCache.delete(key);
        break;
      }
    }
  }

  /**
   * Génère un hash simple pour créer une clé de cache
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Hook React pour la gestion sécurisée des vidéos
 */
export const useSecureVideo = () => {
  const [manager] = useState(() => new VideoSecurityManager());
  
  // Cleanup automatique lors du démontage
  useEffect(() => {
    return () => {
      manager.cleanup();
    };
  }, [manager]);

  return manager;
};

/**
 * Protection anti-clic droit et raccourcis clavier
 */
export const useVideoProtection = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const preventKeyboardShortcuts = (e: KeyboardEvent) => {
      // Désactiver F12, Ctrl+U, Ctrl+Shift+I, etc.
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 's')
      ) {
        e.preventDefault();
        return false;
      }
    };

    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    const preventSelection = (e: Event) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventKeyboardShortcuts);
    document.addEventListener('dragstart', preventDragDrop);
    document.addEventListener('selectstart', preventSelection);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeyboardShortcuts);
      document.removeEventListener('dragstart', preventDragDrop);
      document.removeEventListener('selectstart', preventSelection);
    };
  }, [enabled]);
};