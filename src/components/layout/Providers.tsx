'use client'
import { UserProvider } from '@/lib/user-context'
import { SidebarProvider } from '@/lib/sidebar-context'
import { ThemeProvider } from '@/lib/theme-context'
import { CostingStoreProvider } from '@/lib/costing-store'
import { VendorNotificationProvider } from '@/lib/vendor-notifications'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <UserProvider>
          <CostingStoreProvider>
            <VendorNotificationProvider>{children}</VendorNotificationProvider>
          </CostingStoreProvider>
        </UserProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}
