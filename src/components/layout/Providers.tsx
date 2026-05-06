'use client'
import { UserProvider } from '@/lib/user-context'
import { SidebarProvider } from '@/lib/sidebar-context'
import { ThemeProvider } from '@/lib/theme-context'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <UserProvider>{children}</UserProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}
