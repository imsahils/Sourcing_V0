'use client'
import { useState } from 'react'
import { Bell, Search, Menu } from 'lucide-react'
import { NotificationPanel } from './NotificationPanel'
import { notifications } from '@/lib/data'
import { useSidebar } from '@/lib/sidebar-context'
import { useCurrentUser } from '@/lib/user-context'

const AVATAR_COLORS: Record<string, string> = {
  'sourcing-poc':   '#CC785C',
  'sourcing-mgr':   '#B5633E',
  'category-head':  '#92400E',
  'buying-poc':     '#1D4ED8',
  'qa-mgr':         '#2E7D52',
  'warehouse-ops':  '#6B7280',
  'vendor':         '#78716C',
  'sourcing-mis':   '#A8A29E',
}

export function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const unread = notifications.filter(n => !n.read).length
  const { toggle } = useSidebar()
  const { currentUser } = useCurrentUser()
  const avatarColor = AVATAR_COLORS[currentUser.role] ?? '#CC785C'

  return (
    <>
      <header
        style={{
          position:    'fixed',
          top:         0,
          left:        'var(--ds-sidebar-width)',
          right:       0,
          height:      52,
          background:  'var(--ds-surface)',
          borderBottom:'1px solid var(--ds-border)',
          display:     'flex',
          alignItems:  'center',
          padding:     '0 20px',
          zIndex:      20,
          gap:         10,
        }}
        className="max-md:left-0"
      >
        {/* Hamburger — mobile only */}
        <button
          onClick={toggle}
          className="md:hidden"
          aria-label="Open menu"
          style={{
            padding:     8,
            borderRadius:8,
            border:      'none',
            background:  'none',
            color:       'var(--ds-text-secondary)',
            cursor:      'pointer',
            display:     'flex',
            alignItems:  'center',
            flexShrink:  0,
          }}
        >
          <Menu size={18} />
        </button>

        {/* Title area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <h1 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ds-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </h1>
          )}
          {subtitle && (
            <p style={{ fontSize: 11.5, color: 'var(--ds-text-tertiary)', margin: 0 }} className="hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>

        {/* Search — desktop */}
        <div
          className="hidden md:flex"
          style={{
            alignItems:  'center',
            gap:         7,
            padding:     '7px 12px',
            background:  'var(--ds-bg-subtle)',
            border:      `1px solid ${searchFocused ? 'var(--ds-primary)' : 'var(--ds-border)'}`,
            borderRadius:'var(--ds-radius-sm)',
            fontSize:    12.5,
            color:       'var(--ds-text-tertiary)',
            width:       220,
            cursor:      'pointer',
            boxShadow:   searchFocused ? '0 0 0 3px rgba(204,120,92,0.15)' : 'none',
            transition:  'all 0.15s ease',
          }}
          onMouseEnter={e => { if (!searchFocused) (e.currentTarget as HTMLElement).style.borderColor = 'var(--ds-border-strong)' }}
          onMouseLeave={e => { if (!searchFocused) (e.currentTarget as HTMLElement).style.borderColor = 'var(--ds-border)' }}
          onClick={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          tabIndex={0}
        >
          <Search size={13} color="var(--ds-text-tertiary)" />
          <span>Search orders, vendors…</span>
        </div>

        {/* Notifications */}
        <button
          onClick={() => setNotifOpen(true)}
          style={{
            position:    'relative',
            padding:     7,
            borderRadius:'var(--ds-radius-sm)',
            border:      'none',
            background:  'none',
            color:       'var(--ds-text-secondary)',
            cursor:      'pointer',
            display:     'flex',
            alignItems:  'center',
            flexShrink:  0,
            transition:  'all 0.12s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ds-bg-subtle)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        >
          <Bell size={16} />
          {unread > 0 && (
            <span style={{
              position:       'absolute',
              top:            -2,
              right:          -2,
              width:          16,
              height:         16,
              background:     'var(--ds-danger)',
              color:          '#fff',
              fontSize:       9.5,
              borderRadius:   '50%',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontWeight:     700,
            }}>
              {unread}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div style={{
          width:          32,
          height:         32,
          borderRadius:   '50%',
          background:     avatarColor,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          cursor:         'pointer',
          flexShrink:     0,
        }}>
          <span style={{ color: '#fff', fontSize: 11.5, fontWeight: 700 }}>
            {currentUser.initials}
          </span>
        </div>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}
