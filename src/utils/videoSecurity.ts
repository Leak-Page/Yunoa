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
  private sessionTokens = new Map<string, { token: string; expiresAt: number; refreshTimer?: NodeJS.Timeout }>(); // Tokens de session temporaires

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
   * Utilise des tokens temporaires avec rotation pour empêcher le téléchargement
   * Pas de blob - chargement direct avec support Range requests
   */
  async loadSecureVideo(options: VideoLoadOptions): Promise<string> {
    const { videoUrl, videoId, sessionToken, onProgress, signal } = options;
    
    // Clé de cache basée sur l'URL et l'ID
    const cacheKey = `${videoId}-${this.hashString(videoUrl)}`;
    
    // Créer ou récupérer une session de streaming sécurisée
    let sessionData = this.sessionTokens.get(cacheKey);
    
    if (!sessionData || Date.now() > sessionData.expiresAt) {
      // Créer une nouvelle session
      try {
        const response = await fetch('/api/videos/stream/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({ videoId })
        });
        
        if (!response.ok) {
          throw new Error('Impossible de créer une session de streaming');
        }
        
        const data = await response.json();
        const expiresAt = Date.now() + (data.expiresIn * 1000);
        
        sessionData = {
          token: data.sessionToken,
          expiresAt
        };
        
        this.sessionTokens.set(cacheKey, sessionData);
        
        // Programmer le renouvellement du token (toutes les 30 secondes)
        if (sessionData.refreshTimer) {
          clearInterval(sessionData.refreshTimer);
        }
        
        sessionData.refreshTimer = setInterval(async () => {
          try {
            const refreshResponse = await fetch('/api/videos/stream/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
              },
              body: JSON.stringify({ videoId })
            });
            
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              const newExpiresAt = Date.now() + (refreshData.expiresIn * 1000);
              
              const currentSession = this.sessionTokens.get(cacheKey);
              if (currentSession) {
                currentSession.token = refreshData.sessionToken;
                currentSession.expiresAt = newExpiresAt;
              }
              
              console.log('🔄 Token de streaming renouvelé');
            }
          } catch (error) {
            console.error('Erreur renouvellement token:', error);
          }
        }, (data.refreshInterval || 30) * 1000);
        
      } catch (error) {
        console.error('Erreur création session streaming:', error);
        // Fallback : utiliser le token de session directement (moins sécurisé)
        const streamUrl = `/api/videos/stream/${videoId}?token=${encodeURIComponent(sessionToken)}`;
        this.urlCache.set(cacheKey, streamUrl);
        return streamUrl;
      }
    }

    // Générer l'URL de streaming avec le token de session temporaire
    const streamUrl = `/api/videos/stream/${videoId}?token=${encodeURIComponent(sessionData.token)}`;
    
    // Mettre en cache l'URL (pas de blob)
    this.urlCache.set(cacheKey, streamUrl);

    // Log sécurisé
    console.log('✅ URL de streaming direct générée (sécurisé comme Netflix avec rotation de tokens)');

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
    // Nettoyer les timers de renouvellement
    for (const sessionData of this.sessionTokens.values()) {
      if (sessionData.refreshTimer) {
        clearInterval(sessionData.refreshTimer);
      }
    }
    
    this.urlCache.clear();
    this.sessionTokens.clear();
    console.log('[VideoSecurityManager] 🧹 Cache des URLs et sessions nettoyé');
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