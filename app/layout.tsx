import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MNTN — Landing Page',
  description: 'A cinematic hiking landing page inspired by the MNTN Figma design.',
  keywords: ['mntn', 'landing page', 'hiking', 'figma'],
  openGraph: {
    title: 'MNTN — Landing Page',
    description: 'A cinematic hiking landing page inspired by the MNTN Figma design.',
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
