'use client'

import { type ReactNode } from 'react'
import { ClipboardCheck, Bell, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DEMO_INSPECTOR } from '@/lib/inspection-mock'

/**
 * Inspector mobile-first layout.
 *
 * The root layout renders a desktop sidebar + 52px header. For the inspector
 * mobile flows we render a fixed-position overlay that takes over the full
 * viewport, hiding all desktop chrome behind it. This keeps the inspector
 * experience clean on both mobile (its primary device) and on desktop
 * (for demos / QA Manager looking over the shoulder).
 *
 * Max width on desktop is constrained to ~420px so it visually reads as a
 * phone-shaped surface centred on the page.
 */
export default function InspectorLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const inspector = DEMO_INSPECTOR

  return (
    <div
      style={{
        position:   'fixed',
        top:        0,
        left:       0,
        right:      0,
        bottom:     0,
        zIndex:     200,
        background: 'var(--ds-bg-subtle)',
        overflowY:  'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Phone-shaped frame for desktop viewing */}
      <div
        style={{
          maxWidth:  480,
          minHeight: '100vh',
          margin:    '0 auto',
          background: 'var(--ds-bg)',
          boxShadow: '0 0 40px rgba(28,25,23,0.08)',
          display:   'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top header */}
        <header
          style={{
            position:   'sticky',
            top:        0,
            zIndex:     10,
            background: 'var(--ds-surface)',
            borderBottom: '1px solid var(--ds-border)',
            padding:    '12px 16px',
            display:    'flex',
            alignItems: 'center',
            gap:        12,
          }}
        >
          {/* Brand mark */}
          <div
            onClick={() => router.push('/inspector')}
            style={{
              width:           36,
              height:          36,
              borderRadius:    10,
              background:      'var(--ds-primary)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              color:           '#fff',
              cursor:          'pointer',
              flexShrink:      0,
            }}
          >
            <ClipboardCheck size={18} strokeWidth={2.2} />
          </div>

          {/* Inspector identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize:   14,
                fontWeight: 600,
                color:      'var(--ds-text)',
                lineHeight: 1.2,
                overflow:   'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:  'nowrap',
              }}
            >
              {inspector.name}
            </div>
            <div
              style={{
                fontSize:    11.5,
                color:       'var(--ds-text-tertiary)',
                marginTop:   1,
                display:     'flex',
                alignItems:  'center',
                gap:         6,
              }}
            >
              <span style={{
                padding:      '1px 6px',
                background:   inspector.inspectorType === 'in_house'
                  ? 'var(--ds-primary-light)'
                  : 'var(--ds-info-bg)',
                color:        inspector.inspectorType === 'in_house'
                  ? 'var(--ds-primary-dark)'
                  : 'var(--ds-info)',
                borderRadius: 4,
                fontSize:     10,
                fontWeight:   600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}>
                {inspector.inspectorType === 'in_house' ? 'In-House' : inspector.agencyName}
              </span>
              <span>Bewakoof QA</span>
            </div>
          </div>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            style={{
              width:        38,
              height:       38,
              borderRadius: 10,
              border:       '1px solid var(--ds-border)',
              background:   'var(--ds-surface)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              color:        'var(--ds-text-secondary)',
              cursor:       'pointer',
              position:     'relative',
              flexShrink:   0,
            }}
          >
            <Bell size={16} strokeWidth={2} />
            <span
              style={{
                position:    'absolute',
                top:         6,
                right:       6,
                width:       8,
                height:      8,
                borderRadius: '50%',
                background:  'var(--ds-danger)',
                border:      '1.5px solid var(--ds-surface)',
              }}
            />
          </button>

          {/* Exit (back to Fabricate OMS) */}
          <button
            type="button"
            aria-label="Exit inspector"
            onClick={() => router.push('/')}
            title="Exit to Fabricate"
            style={{
              width:        38,
              height:       38,
              borderRadius: 10,
              border:       '1px solid var(--ds-border)',
              background:   'var(--ds-surface)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              color:        'var(--ds-text-tertiary)',
              cursor:       'pointer',
              flexShrink:   0,
            }}
          >
            <LogOut size={15} strokeWidth={2} />
          </button>
        </header>

        {/* Main content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
