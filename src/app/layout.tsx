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
      {/* Inline script runs before paint — prevents flash of wrong theme */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('drishti-theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased transition-colors duration-200">
        <Providers>
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main className="md:ml-60 min-h-screen pt-14">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
