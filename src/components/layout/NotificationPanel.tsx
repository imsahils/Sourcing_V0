'use client'
import { X, Bell, AlertCircle, CheckCircle, Clock, Info } from 'lucide-react'
import { notifications } from '@/lib/data'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/types'
import { format } from 'date-fns'

const iconMap = {
  overdue:   { icon: AlertCircle, cls: 'text-red-500 bg-red-50' },
  'due-today': { icon: Clock, cls: 'text-amber-500 bg-amber-50' },
  completed: { icon: CheckCircle, cls: 'text-green-500 bg-green-50' },
  info:      { icon: Info, cls: 'text-violet-500 bg-violet-50' },
}

function NotifItem({ n }: { n: Notification }) {
  const { icon: Icon, cls } = iconMap[n.type]
  return (
    <div className={cn('flex gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0', !n.read && 'bg-violet-50/40')}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cls)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm text-slate-800 leading-snug', !n.read && 'font-medium')}>{n.message}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {format(new Date(n.timestamp), 'MMM d, hh:mm a')}
        </p>
      </div>
      {!n.read && <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />}
    </div>
  )
}

export function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const unread = notifications.filter(n => !n.read).length
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      )}

      {/* Panel */}
      <div className={cn(
        'fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out border-l border-slate-200',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-600" />
            <h2 className="font-semibold text-slate-900 text-sm">Notifications</h2>
            {unread > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{unread}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="text-xs text-violet-600 hover:text-violet-700 font-medium">Mark all read</button>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.map(n => <NotifItem key={n.id} n={n} />)}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200">
          <button className="w-full text-center text-xs text-violet-600 hover:text-violet-700 font-medium py-1">
            View all notifications
          </button>
        </div>
      </div>
    </>
  )
}
