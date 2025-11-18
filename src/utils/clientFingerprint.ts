/**
 * Génération d'empreinte unique du navigateur
 * Utilisé pour lier les sessions vidéo à un client spécifique
 */

interface FingerprintData {
  canvas: string;
  webgl: string;
  audio: string;
  fonts: string[];
  plugins: string[];
  timezone: string;
  languages: string[];
  screen: string;
  hardware: string;
}

export class ClientFingerprint {
  private static instance: ClientFingerprint;
  private fingerprint: string | null = null;

  private constructor() {}

  static getInstance(): ClientFingerprint {
    if (!ClientFingerprint.instance) {
      ClientFingerprint.instance = new ClientFingerprint();
    }
    return ClientFingerprint.instance;
  }

  /**
   * Génère une empreinte unique basée sur les caractéristiques du navigateur
   */
  async generate(): Promise<string> {
    if (this.fingerprint) {
      return this.fingerprint;
    }

    const data: FingerprintData = {
      canvas: await this.getCanvasFingerprint(),
      webgl: this.getWebGLFingerprint(),
      audio: await this.getAudioFingerprint(),
      fonts: this.getFonts(),
      plugins: this.getPlugins(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: navigator.languages ? Array.from(navigator.languages) : [navigator.language],
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      hardware: `${navigator.hardwareConcurrency || 0}`
    };

    const fingerprint = await this.hashFingerprint(JSON.stringify(data));
    this.fingerprint = fingerprint;
    return fingerprint;
  }

  /**
   * Canvas fingerprinting
   */
  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      canvas.width = 200;
      canvas.height = 50;

      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('StreamFlix 🔒', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Security', 4, 17);

      return canvas.toDataURL();
    } catch {
      return '';
    }
  }

  /**
   * WebGL fingerprinting
   */
  private getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      if (!gl) return '';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return '';

      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

      return `${vendor}~${renderer}`;
    } catch {
      return '';
    }
  }

  /**
   * Audio fingerprinting
   */
  private async getAudioFingerprint(): Promise<string> {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return '';

      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gainNode = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

      gainNode.gain.value = 0;
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(0);

      return new Promise((resolve) => {
        scriptProcessor.onaudioprocess = function(event) {
          const output = event.outputBuffer.getChannelData(0);
          const hash = Array.from(output.slice(0, 30)).join('');
          oscillator.stop();
          scriptProcessor.disconnect();
          gainNode.disconnect();
          analyser.disconnect();
          oscillator.disconnect();
          context.close();
          resolve(hash);
        };
      });
    } catch {
      return '';
    }
  }

  /**
   * Détection des fonts installées
   */
  private getFonts(): string[] {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
      'Palatino', 'Garamond', 'Comic Sans MS', 'Trebuchet MS', 'Impact'
    ];

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return [];

    const detectedFonts: string[] = [];

    testFonts.forEach(font => {
      let detected = false;
      baseFonts.forEach(baseFont => {
        context.font = `72px ${baseFont}`;
        const baseWidth = context.measureText('mmmmmmmmmmlli').width;
        
        context.font = `72px ${font}, ${baseFont}`;
        const testWidth = context.measureText('mmmmmmmmmmlli').width;
        
        if (baseWidth !== testWidth) {
          detected = true;
        }
      });
      if (detected) {
        detectedFonts.push(font);
      }
    });

    return detectedFonts;
  }

  /**
   * Liste des plugins installés
   */
  private getPlugins(): string[] {
    if (!navigator.plugins) return [];
    return Array.from(navigator.plugins).map(p => p.name);
  }

  /**
   * Hash l'empreinte
   */
  private async hashFingerprint(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Récupère l'empreinte actuelle
   */
  getFingerprint(): string | null {
    return this.fingerprint;
  }

  /**
   * Réinitialise l'empreinte
   */
  reset(): void {
    this.fingerprint = null;
  }
}

export const clientFingerprint = ClientFingerprint.getInstance();
