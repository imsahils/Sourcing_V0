'use client'
//
// ─── NotificationCenter (Phase F) ──────────────────────────────────────────
//
// Bell-icon dropdown for the OTB module. Pulls notifications + helpers from
// the cross-tab grid store. Self-contained — drop it into any header.
//

import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCircle2, AlertCircle, Info, Clock, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGridStore } from '@/lib/grid-store'
import type { Notification, NotificationType } from '@/lib/types'

export function NotificationCenter() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useGridStore()

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={() => setOpen(o => !o)}
        className={cn('relative p-2 rounded-xl border transition-colors',
          open
            ? 'bg-violet-50 border-violet-200 text-violet-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        )}
        title="Notifications">
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[400px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadNotificationCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                  {unreadNotificationCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadNotificationCount > 0 && (
                <button onClick={markAllNotificationsRead}
                  className="text-[11px] text-violet-600 hover:underline font-medium px-2 py-1">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[480px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                <Bell className="w-8 h-8 opacity-40" />
                <p className="text-xs">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul>
                {notifications.map(n => (
                  <NotificationItem key={n.id} n={n} onMarkRead={() => markNotificationRead(n.id)} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Single notification row ───────────────────────────────────────────────
function NotificationItem({ n, onMarkRead }: { n: Notification; onMarkRead: () => void }) {
  const meta = TYPE_META[n.type]
  return (
    <li className={cn(
      'flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors',
      n.read ? 'bg-white hover:bg-slate-50' : 'bg-violet-50/40 hover:bg-violet-50/60',
    )}>
      <div className={cn('mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0', meta.bg)}>
        <meta.Icon className={cn('w-3.5 h-3.5', meta.fg)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs leading-relaxed', n.read ? 'text-slate-600' : 'text-slate-900 font-medium')}>
          {n.message}
        </p>
        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> {relativeTime(n.timestamp)}
        </p>
      </div>
      {!n.read && (
        <button onClick={onMarkRead}
          title="Mark as read"
          className="p-1 rounded text-slate-300 hover:text-violet-600 hover:bg-violet-50 transition-colors">
          <Check className="w-3 h-3" />
        </button>
      )}
    </li>
  )
}

const TYPE_META: Record<NotificationType, { Icon: React.ComponentType<{ className?: string }>; bg: string; fg: string }> = {
  'overdue':   { Icon: AlertCircle,   bg: 'bg-red-100',    fg: 'text-red-600'    },
  'due-today': { Icon: AlertCircle,   bg: 'bg-amber-100',  fg: 'text-amber-600'  },
  'completed': { Icon: CheckCircle2,  bg: 'bg-green-100',  fg: 'text-green-700'  },
  'info':      { Icon: Info,          bg: 'bg-blue-100',   fg: 'text-blue-600'   },
}

// "5 mins ago", "2 hours ago", "yesterday", "23 May" — same scheme as portfolio queue.
function relativeTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const diffMs = Date.now() - t
  const min  = Math.round(diffMs / 60_000)
  if (min < 1)    return 'just now'
  if (min < 60)   return `${min}m ago`
  const hr  = Math.round(min / 60)
  if (hr < 24)    return `${hr}h ago`
  const d = new Date(t)
  const day = Math.round(hr / 24)
  if (day === 1)  return 'yesterday'
  if (day < 7)    return `${day}d ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
