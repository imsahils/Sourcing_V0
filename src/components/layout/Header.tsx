'use client'
import { useState } from 'react'
import { Bell, Search, Menu } from 'lucide-react'
import { NotificationPanel } from './NotificationPanel'
import { notifications } from '@/lib/data'
import { useSidebar } from '@/lib/sidebar-context'

export function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const unread = notifications.filter(n => !n.read).length
  const { toggle } = useSidebar()

  return (
    <>
      <header className="fixed top-0 left-0 md:left-60 right-0 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 flex items-center px-4 md:px-6 z-20 gap-3 transition-colors duration-200">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggle}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Title area */}
        <div className="flex-1 min-w-0">
          {title && <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</h1>}
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">{subtitle}</p>}
        </div>

        {/* Search — hidden on small screens */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-400 dark:text-slate-500 w-56 cursor-pointer hover:border-violet-300 dark:hover:border-violet-600 transition-colors">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Search SubOrders, vendors…</span>
        </div>

        {/* Notifications */}
        <button
          onClick={() => setNotifOpen(true)}
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <Bell className="w-4.5 h-4.5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center cursor-pointer flex-shrink-0">
          <span className="text-white text-xs font-bold">PK</span>
        </div>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}
