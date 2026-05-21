import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Providers } from '@/components/layout/Providers'

export const metadata: Metadata = {
  title: 'Fabricate — Sourcing Order Management',
  description: 'TMRW House of Brands · Nautinati Sourcing OMS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background:  'var(--ds-bg)',
        color:       'var(--ds-text)',
        margin:      0,
        padding:     0,
        minHeight:   '100vh',
        WebkitFontSmoothing: 'antialiased',
      }}>
        <Providers>
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main style={{
            minHeight:   '100vh',
            background:  'var(--ds-bg)',
            paddingTop:  52,
          }}
            className="ml-0 md:ml-[var(--ds-sidebar-width)]"
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
