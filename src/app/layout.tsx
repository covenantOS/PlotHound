import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PlotHound - Genealogy Research Workflow',
  description:
    'A research operations tool for genealogists. Track what you have tried, organize your findings, and break through brick walls with AI-powered suggestions.',
  keywords: ['genealogy', 'family history', 'research', 'ancestors', 'family tree'],
  authors: [{ name: 'PlotHound' }],
  openGraph: {
    title: 'PlotHound - Genealogy Research Workflow',
    description:
      'Ancestry stores records. PlotHound runs your research. Track sources, test hypotheses, and break through brick walls.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
