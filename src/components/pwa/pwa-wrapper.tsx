'use client'

import { ReactNode } from 'react'
import { PWAProvider } from './pwa-provider'
import { InstallPrompt } from './install-prompt'
import { DesktopMobileHint } from './desktop-mobile-hint'

interface PWAWrapperProps {
  children: ReactNode
}

export function PWAWrapper({ children }: PWAWrapperProps) {
  return (
    <PWAProvider>
      {children}
      <InstallPrompt />
      <DesktopMobileHint />
    </PWAProvider>
  )
}
