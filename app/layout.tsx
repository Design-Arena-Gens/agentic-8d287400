import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Universe Sandbox',
  description: 'A fully-featured universe simulation using Three.js',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
