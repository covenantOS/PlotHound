'use client'

import { useEffect, useState } from 'react'
import { usePWA } from './pwa-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dog, X, Download, Share, Plus, Smartphone } from 'lucide-react'

export function InstallPrompt() {
  const { isInstallable, isInstalled, isIOS, isStandalone, installApp, dismissInstallPrompt, showInstallPrompt } = usePWA()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Don't show if already installed, not installable, or prompt dismissed
  if (isInstalled || isStandalone || !isInstallable || !showInstallPrompt) {
    return null
  }

  // Only show on mobile
  if (!isMobile) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-safe">
      <Card className="bg-card/95 backdrop-blur-lg border-primary/20 shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Dog className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">Install PlotHound</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Add to your home screen for the best experience
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 -mt-1"
              onClick={dismissInstallPrompt}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isIOS ? (
            // iOS install instructions
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  1
                </div>
                <div className="flex items-center gap-2">
                  <span>Tap the</span>
                  <Share className="h-4 w-4 text-primary" />
                  <span>Share button below</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  2
                </div>
                <div className="flex items-center gap-2">
                  <span>Scroll and tap</span>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded">
                    <Plus className="h-3 w-3" />
                    Add to Home Screen
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  3
                </div>
                <span>Tap &quot;Add&quot; to install</span>
              </div>
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={dismissInstallPrompt}
              >
                Got it
              </Button>
            </div>
          ) : (
            // Android/Chrome install button
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={dismissInstallPrompt}
              >
                Not now
              </Button>
              <Button
                className="flex-1"
                onClick={installApp}
              >
                <Download className="mr-2 h-4 w-4" />
                Install
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
