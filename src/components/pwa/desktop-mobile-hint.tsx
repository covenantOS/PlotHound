'use client'

import { useState, useEffect } from 'react'
import { usePWA } from './pwa-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Smartphone, X, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export function DesktopMobileHint() {
  const { isStandalone } = usePWA()
  const [isDesktop, setIsDesktop] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)

    // Check if dismissed
    const wasDismissed = localStorage.getItem('desktop-mobile-hint-dismissed')
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10)
      // Show again after 14 days
      if (Date.now() - dismissedTime > 14 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('desktop-mobile-hint-dismissed')
      } else {
        setDismissed(true)
      }
    }

    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('desktop-mobile-hint-dismissed', Date.now().toString())
  }

  // Don't show if not desktop, already in standalone mode, or dismissed
  if (!isDesktop || isStandalone || dismissed) {
    return null
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-xs">
      <Card className="bg-card/95 backdrop-blur-sm border shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm">Mobile App Available</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mr-1 -mt-1"
                  onClick={handleDismiss}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Research your family tree on the go with our mobile app.
              </p>
            </div>
          </div>

          {showQR ? (
            <div className="mt-3 p-3 bg-white rounded-lg flex flex-col items-center">
              <QRCodeSVG
                value={appUrl}
                size={128}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={true}
              />
              <p className="text-[10px] text-gray-500 mt-2 text-center">
                Scan with your phone camera
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => setShowQR(false)}
              >
                Hide QR Code
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2 text-xs">
                <p className="font-medium">How to install:</p>
                <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
                  <li>Open <span className="font-mono text-[10px] bg-muted px-1 rounded">{appUrl.replace('https://', '')}</span> on your phone</li>
                  <li>Log in to your account</li>
                  <li>Tap &quot;Add to Home Screen&quot; when prompted</li>
                </ol>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setShowQR(true)}
                >
                  <QrCode className="mr-1 h-3 w-3" />
                  Show QR
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleDismiss}
                >
                  Dismiss
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
