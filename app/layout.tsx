import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'XDL — X Video Downloader',
  description: 'Download X videos with a cinematic ESO-branded interface.',
  keywords: ['x video downloader', 'xdl', 'eso'],
  openGraph: {
    title: 'XDL — X Video Downloader',
    description: 'Download X videos with a cinematic ESO-branded interface.',
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
      </head>
      <body className="antialiased font-body bg-[#0b1d26] text-white">{children}</body>
    </html>
  )
}
