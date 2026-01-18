import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PWAWrapper } from '@/components/pwa/pwa-wrapper'

export const metadata: Metadata = {
  title: 'PlotHound - Genealogy Research Workflow',
  description:
    'A research operations tool for genealogists. Track what you have tried, organize your findings, and break through brick walls with AI-powered suggestions.',
  keywords: ['genealogy', 'family history', 'research', 'ancestors', 'family tree'],
  authors: [{ name: 'PlotHound' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PlotHound',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'PlotHound - Genealogy Research Workflow',
    description:
      'Ancestry stores records. PlotHound runs your research. Track sources, test hypotheses, and break through brick walls.',
    type: 'website',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PlotHound" />
        {/* Splash screens for iOS */}
        <link
          rel="apple-touch-startup-image"
          href="/icons/icon-512x512.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
      </head>
      <body className="antialiased">
        <PWAWrapper>
          {children}
        </PWAWrapper>
      </body>
    </html>
  )
}
