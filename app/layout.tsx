import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'XDL — Twitter/X Video Downloader',
  description: 'Download Twitter and X videos in any quality. Fast, free, no signup required.',
  keywords: ['twitter video downloader', 'x video downloader', 'download twitter video'],
  openGraph: {
    title: 'XDL — Twitter/X Video Downloader',
    description: 'Download Twitter and X videos in any quality.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
