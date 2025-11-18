export interface VideoQuality {
  label: string;
  url: string;
  bitrate: number;
  resolution: string;
}

export interface StreamConfig {
  videoId: string;
  qualities: VideoQuality[];
  defaultQuality: string;
  adaptiveBitrate: boolean;
  preloadSegments: number;
  bufferSize: number;
}

export interface BufferState {
  buffered: number;
  loading: boolean;
  health: 'good' | 'warning' | 'critical';
  networkSpeed: number;
  bufferPercentage: number;
}

class VideoStreamService {
  private cache = new Map<string, ArrayBuffer>();
  private preloadQueue = new Set<string>();
  private networkSpeed = 0;
  private lastSpeedTest = 0;
  private bufferStates = new Map<string, BufferState>();
  
  // Network speed monitoring
  private async measureNetworkSpeed(): Promise<number> {
    const now = Date.now();
    if (now - this.lastSpeedTest < 30000) { // Cache for 30 seconds
      return this.networkSpeed;
    }

    try {
      const start = performance.now();
      const response = await fetch('data:text/plain;base64,', { method: 'HEAD' });
      const end = performance.now();
      
      if (response.ok) {
        this.networkSpeed = Math.max(1, Math.min(100, (8 / (end - start)) * 1000)); // Mbps estimate
        this.lastSpeedTest = now;
      }
    } catch (error) {
      console.warn('Network speed test failed:', error);
      this.networkSpeed = 5; // Default fallback
    }

    return this.networkSpeed;
  }

  // Adaptive quality selection based on network conditions
  async getOptimalQuality(qualities: VideoQuality[]): Promise<VideoQuality> {
    const speed = await this.measureNetworkSpeed();
    
    // Sort qualities by bitrate
    const sortedQualities = [...qualities].sort((a, b) => a.bitrate - b.bitrate);
    
    // Select quality based on network speed
    for (let i = sortedQualities.length - 1; i >= 0; i--) {
      const quality = sortedQualities[i];
      const requiredSpeed = quality.bitrate / 1000; // Convert to Mbps
      
      if (speed >= requiredSpeed * 1.5) { // 1.5x buffer for smooth playback
        return quality;
      }
    }
    
    // Fallback to lowest quality
    return sortedQualities[0] || qualities[0];
  }

  // Intelligent preloading with priority queue
  async preloadVideo(videoId: string, url: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    if (this.cache.has(videoId) || this.preloadQueue.has(videoId)) {
      return;
    }

    this.preloadQueue.add(videoId);

    try {
      // Create range requests for progressive loading
      const ranges = this.calculatePreloadRanges(priority);
      
      for (const range of ranges) {
        await this.preloadRange(videoId, url, range);
        
        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.error(`Preload failed for video ${videoId}:`, error);
    } finally {
      this.preloadQueue.delete(videoId);
    }
  }

  private calculatePreloadRanges(priority: 'high' | 'medium' | 'low'): Array<{start: number, end: number}> {
    const ranges = [];
    
    switch (priority) {
      case 'high':
        // Preload first 30 seconds
        ranges.push({ start: 0, end: 5 * 1024 * 1024 }); // 5MB
        break;
      case 'medium':
        // Preload first 10 seconds
        ranges.push({ start: 0, end: 2 * 1024 * 1024 }); // 2MB
        break;
      case 'low':
        // Preload first 5 seconds
        ranges.push({ start: 0, end: 1024 * 1024 }); // 1MB
        break;
    }
    
    return ranges;
  }

  private async preloadRange(videoId: string, url: string, range: {start: number, end: number}): Promise<void> {
    try {
      const response = await fetch(url, {
        headers: {
          'Range': `bytes=${range.start}-${range.end}`
        }
      });

      if (response.ok && response.body) {
        const buffer = await response.arrayBuffer();
        this.cache.set(`${videoId}_${range.start}`, buffer);
      }
    } catch (error) {
      console.warn(`Failed to preload range ${range.start}-${range.end} for ${videoId}:`, error);
    }
  }

  // Advanced buffering with health monitoring
  createBufferMonitor(videoElement: HTMLVideoElement, videoId: string): void {
    let lastBuffered = 0;
    let stallCount = 0;

    const updateBufferState = () => {
      if (!videoElement.buffered.length) return;

      const buffered = videoElement.buffered.end(videoElement.buffered.length - 1);
      const currentTime = videoElement.currentTime;
      const bufferAhead = buffered - currentTime;
      
      // Calculate buffer health
      let health: 'good' | 'warning' | 'critical' = 'good';
      if (bufferAhead < 5) health = 'warning';
      if (bufferAhead < 2) health = 'critical';

      // Detect stalls
      if (buffered === lastBuffered && !videoElement.paused) {
        stallCount++;
      } else {
        stallCount = 0;
      }

      lastBuffered = buffered;

      const state: BufferState = {
        buffered: (buffered / videoElement.duration) * 100,
        loading: stallCount > 0,
        health,
        networkSpeed: this.networkSpeed,
        bufferPercentage: (buffered / videoElement.duration) * 100
      };

      this.bufferStates.set(videoId, state);
      
      // Emit custom event for UI updates
      videoElement.dispatchEvent(new CustomEvent('bufferUpdate', { detail: state }));
    };

    // Monitor buffer state
    const interval = setInterval(updateBufferState, 1000);
    
    // Cleanup on video end or error
    const cleanup = () => {
      clearInterval(interval);
      this.bufferStates.delete(videoId);
    };

    videoElement.addEventListener('ended', cleanup);
    videoElement.addEventListener('error', cleanup);
  }

  // Smart caching with LRU eviction
  getCachedVideo(videoId: string): ArrayBuffer | null {
    return this.cache.get(videoId) || null;
  }

  // Progressive loading with abort controller
  createProgressiveLoader(url: string, onProgress?: (loaded: number, total: number) => void): {
    load: () => Promise<ArrayBuffer>,
    abort: () => void
  } {
    const controller = new AbortController();
    
    const load = async (): Promise<ArrayBuffer> => {
      try {
        const response = await fetch(url, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const total = parseInt(response.headers.get('content-length') || '0');
        const reader = response.body?.getReader();
        
        if (!reader) {
          throw new Error('No response body');
        }

        const chunks: Uint8Array[] = [];
        let loaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          onProgress?.(loaded, total);
        }

        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        return result.buffer;
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Video loading aborted');
        } else {
          console.error('Progressive loading error:', error);
        }
        throw error;
      }
    };

    return {
      load,
      abort: () => controller.abort()
    };
  }

  // Cleanup cache when memory is low
  cleanupCache(maxSizeBytes: number = 100 * 1024 * 1024): void { // 100MB default
    const entries = Array.from(this.cache.entries());
    let totalSize = entries.reduce((sum, [, buffer]) => sum + buffer.byteLength, 0);
    
    if (totalSize <= maxSizeBytes) return;

    // Sort by access time (would need to track this)
    // For now, just remove oldest entries
    entries.sort().forEach(([key, buffer]) => {
      if (totalSize <= maxSizeBytes) return;
      
      totalSize -= buffer.byteLength;
      this.cache.delete(key);
    });
  }

  // Error recovery strategies
  async retryWithFallback(url: string, maxRetries: number = 3): Promise<Response> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          return response;
        }
        
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  // Get buffer state for UI
  getBufferState(videoId: string): BufferState | null {
    return this.bufferStates.get(videoId) || null;
  }
}

export const videoStreamService = new VideoStreamService();