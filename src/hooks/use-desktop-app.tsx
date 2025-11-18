import { useState, useEffect } from 'react';

export function useDesktopApp() {
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [appInfo, setAppInfo] = useState<{
    name: string;
    version: string;
    platform: string;
  } | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    
    // Détection de l'application YunoaApp
    if (userAgent.includes('YunoaApp')) {
      setIsDesktopApp(true);
      
      // Extraction des informations de l'User-Agent
      const match = userAgent.match(/YunoaApp\/([0-9.]+)\s*\(([^)]+)\)/);
      if (match) {
        setAppInfo({
          name: 'YunoaApp',
          version: match[1],
          platform: match[2]
        });
      }
    }
  }, []);

  return {
    isDesktopApp,
    appInfo
  };
}