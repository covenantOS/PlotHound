'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface PWAContextType {
  isInstallable: boolean
  isInstalled: boolean
  isIOS: boolean
  isStandalone: boolean
  installApp: () => Promise<void>
  dismissInstallPrompt: () => void
  showInstallPrompt: boolean
}

const PWAContext = createContext<PWAContextType | undefined>(undefined)

export function usePWA() {
  const context = useContext(PWAContext)
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider')
  }
  return context
}

interface PWAProviderProps {
  children: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [promptDismissed, setPromptDismissed] = useState(false)

  useEffect(() => {
    // Check if already installed
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
      setIsInstalled(standalone);
    };

    // Check if iOS
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);

      // iOS doesn't support beforeinstallprompt, but we can still show install instructions
      if (isIOSDevice && !isStandalone) {
        setIsInstallable(true);
      }
    };

    // Check if prompt was previously dismissed
    const checkDismissed = () => {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        // Show again after 7 days
        if (Date.now() - dismissedTime > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem('pwa-install-dismissed');
        } else {
          setPromptDismissed(true);
        }
      }
    };

    checkStandalone();
    checkIOS();
    checkDismissed();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('SW registered:', registration.scope);
      }).catch((error) => {
        console.log('SW registration failed:', error);
      });
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);

      // Show prompt after a delay if not dismissed
      if (!promptDismissed) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 3000);
      }
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show iOS prompt after delay
    if (!promptDismissed && !isStandalone) {
      setTimeout(() => {
        if (isIOS) {
          setShowInstallPrompt(true);
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone, promptDismissed, isIOS]);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      // For iOS, we can't programmatically install
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        console.log('User accepted install prompt');
      } else {
        console.log('User dismissed install prompt');
      }

      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Install error:', error);
    }
  }, [deferredPrompt]);

  const dismissInstallPrompt = useCallback(() => {
    setShowInstallPrompt(false);
    setPromptDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isIOS,
        isStandalone,
        installApp,
        dismissInstallPrompt,
        showInstallPrompt,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}
