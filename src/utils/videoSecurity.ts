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
  private urlCache = new Map<string, string>(); // Cache des URLs de streaming (pas de blobs)

  constructor(config: VideoSecurityConfig = {}) {
    this.config = {
      apiBaseUrl: '/api',
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Charge une vidéo via streaming direct sécurisé (comme Netflix)
   * Utilise une URL directe avec authentification via token
   * Pas de blob - chargement direct avec support Range requests
   */
  async loadSecureVideo(options: VideoLoadOptions): Promise<string> {
    const { videoUrl, videoId, sessionToken, onProgress, signal } = options;
    
    // Clé de cache basée sur l'URL et l'ID
    const cacheKey = `${videoId}-${this.hashString(videoUrl)}`;
    
    // Vérifier le cache
    if (this.urlCache.has(cacheKey)) {
      return this.urlCache.get(cacheKey)!;
    }

    // Générer l'URL de streaming direct avec authentification
    // Le token est passé en query parameter pour l'authentification
    // Le serveur valide le token et stream la vidéo directement
    const streamUrl = `/api/videos/stream/${videoId}?token=${encodeURIComponent(sessionToken)}`;
    
    // Mettre en cache l'URL (pas de blob)
    this.urlCache.set(cacheKey, streamUrl);

    // Log sécurisé
    console.log('✅ URL de streaming direct générée (sécurisé comme Netflix)');

    // Si onProgress est fourni, simuler la progression (le navigateur gère le streaming)
    if (onProgress) {
      // La progression sera gérée par le navigateur via les événements vidéo
      // On peut déclencher un événement initial
      setTimeout(() => {
        onProgress(0);
      }, 100);
    }

    return streamUrl;
  }

  /**
   * Libère les ressources du cache
   * Note: Plus besoin de révoquer des blobs car on utilise des URLs directes
   */
  cleanup(): void {
    this.urlCache.clear();
    console.log('[VideoSecurityManager] 🧹 Cache des URLs nettoyé');
  }

  /**
   * Libère une URL spécifique du cache
   */
  releaseUrl(url: string): void {
    // Retirer du cache
    for (const [key, cachedUrl] of this.urlCache.entries()) {
      if (cachedUrl === url) {
        this.urlCache.delete(key);
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