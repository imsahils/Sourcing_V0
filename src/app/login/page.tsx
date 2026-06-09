'use client'
import { useState, useEffect } from 'react'
import { Layers, ArrowRight, Loader2 } from 'lucide-react'
import { login, getToken } from '@/lib/api/auth'
import type { UserRole } from '@/lib/user-context'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#FAF9F6',
  surface:     '#FFFFFF',
  text:        '#1C1917',
  sec:         '#78716C',
  ter:         '#A8A29E',
  border:      '#E7E5E0',
  borderStrong:'#D6D3CD',
  primary:     '#CC785C',
  primaryDark: '#B5633E',
  primaryLight:'#FDF0EB',
  danger:      '#B91C1C',
  dangerBg:    '#FEF2F2',
  dangerBorder:'#FECACA',
  bgSubtle:    '#F5F4EF',
}

// ─── Demo users ───────────────────────────────────────────────────────────────
const DEMO_USERS: {
  id: string; name: string; email: string; password: string
  role: UserRole; initials: string; department: string; redirect: string
  avatarColor: string; vendorId?: string
}[] = [
  { id: 'u1', name: 'Parthipan Kumar', email: 'poc@demo.com',       password: 'demo', role: 'sourcing-poc',  initials: 'PK', department: 'Sourcing',  avatarColor: '#CC785C', redirect: '/portfolio?tab=dashboard' },
  { id: 'u2', name: 'Priya Menon',     email: 'manager@demo.com',   password: 'demo', role: 'sourcing-mgr',  initials: 'PM', department: 'Sourcing',  avatarColor: '#B5633E', redirect: '/portfolio?tab=dashboard' },
  { id: 'u3', name: 'Megha Sharma',    email: 'category@demo.com',  password: 'demo', role: 'category-head', initials: 'MS', department: 'Buying',    avatarColor: '#92400E', redirect: '/category-head' },
  { id: 'u4', name: 'Rahul Desai',     email: 'buyer@demo.com',     password: 'demo', role: 'buying-poc',    initials: 'RD', department: 'Buying',    avatarColor: '#1D4ED8', redirect: '/order-management?tab=grid' },
  { id: 'u5', name: 'Ankit Verma',     email: 'qa@demo.com',        password: 'demo', role: 'qa-mgr',        initials: 'AV', department: 'QA',        avatarColor: '#2E7D52', redirect: '/qa' },
  { id: 'u6', name: 'Arul Pandey',     email: 'inspector@demo.com', password: 'demo', role: 'qa-inspector',  initials: 'AP', department: 'QA',        avatarColor: '#0F766E', redirect: '/inspector' },
  { id: 'u7', name: 'Sunit Jain',      email: 'warehouse@demo.com', password: 'demo', role: 'warehouse-ops', initials: 'SJ', department: 'Warehouse', avatarColor: '#6B7280', redirect: '/warehouse' },
  { id: 'u8', name: 'Bharti Apparels', email: 'vendor@demo.com',    password: 'demo', role: 'vendor',        initials: 'BA', department: 'Vendor',    avatarColor: '#78716C', redirect: '/vendor-portal', vendorId: 'v1' },
  { id: 'u9',  name: 'Riya Kapoor',     email: 'mis@demo.com',       password: 'demo', role: 'sourcing-mis',   initials: 'RK', department: 'Sourcing', avatarColor: '#A8A29E', redirect: '/purchase-orders' },
  { id: 'u10', name: 'Subashree Nair',  email: 'designer@demo.com',  password: 'demo', role: 'designer',       initials: 'SN', department: 'Design',   avatarColor: '#DB2777', redirect: '/pre-prod?view=queue' },
  { id: 'u11', name: 'Meera Pillai',    email: 'fittech@demo.com',   password: 'demo', role: 'fit-technician', initials: 'MP', department: 'Design',   avatarColor: '#7C3AED', redirect: '/pre-prod?view=queue' },
]

const ROLE_LABEL: Record<UserRole, string> = {
  'buying-poc':     'Buying POC',
  'sourcing-poc':   'Sourcing POC',
  'sourcing-mgr':   'Sourcing Manager',
  'sourcing-mis':   'Sourcing MIS',
  'qa-inspector':   'QA Inspector',
  'qa-mgr':         'QA Manager',
  'warehouse-ops':  'Warehouse Ops',
  'category-head':  'Category Head',
  'vendor':         'Vendor Partner',
  'designer':       'Designer',
  'fit-technician': 'Fit Technician',
  'super-admin':    'Super Admin',
}

function demoLogin(user: typeof DEMO_USERS[0]) {
  const payload = {
    id: user.id, name: user.name, email: user.email,
    role: user.role, department: user.department, initials: user.initials,
    vendorId: user.vendorId ?? null,
  }
  localStorage.setItem('fabricate-token', 'demo-token-' + user.id)
  localStorage.setItem('fabricate-user', JSON.stringify(payload))
  window.location.href = user.redirect
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [mode,     setMode]     = useState<'login' | 'demo'>('login')
  const [inputFocus, setInputFocus] = useState<string | null>(null)

  useEffect(() => {
    if (getToken()) window.location.href = '/portfolio?tab=dashboard'
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const demoUser = DEMO_USERS.find(u => u.email === email && u.password === password)
    if (demoUser) { demoLogin(demoUser); return }

    try {
      const res = await login(email, password)
      const role = res.user.role as UserRole
      const redirectMap: Partial<Record<UserRole, string>> = {
        'vendor':         '/vendor-portal',
        'qa-inspector':   '/inspector',
        'qa-mgr':         '/qa',
        'warehouse-ops':  '/warehouse',
        'sourcing-mis':   '/purchase-orders',
        'designer':       '/sampling',
        'fit-technician': '/sampling',
      }
      window.location.href = redirectMap[role] ?? '/portfolio?tab=dashboard'
    } catch {
      setError('Invalid credentials. Try the demo accounts below.')
      setLoading(false)
    }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width:        '100%',
    padding:      '10px 13px',
    border:       `1px solid ${inputFocus === field ? C.primary : C.border}`,
    borderRadius: 8,
    fontSize:     14,
    fontFamily:   'Inter, system-ui, sans-serif',
    background:   C.surface,
    color:        C.text,
    outline:      'none',
    boxShadow:    inputFocus === field ? `0 0 0 3px rgba(204,120,92,0.18)` : 'none',
    transition:   'all 0.15s ease',
  })

  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '40px 16px',
      background:     C.bg,
      fontFamily:     'Inter, system-ui, sans-serif',
    }}>
      {/* ── Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(204,120,92,0.35)',
        }}>
          <Layers size={20} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Fabricate
          </div>
          <div style={{ fontSize: 11.5, color: C.ter, marginTop: 2 }}>
            Sourcing Order Management · Nautinati AW 26
          </div>
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div style={{
        display:       'flex',
        gap:           4,
        background:    C.bgSubtle,
        padding:       4,
        borderRadius:  10,
        border:        `1px solid ${C.border}`,
        marginBottom:  24,
        width:         '100%',
        maxWidth:      380,
      }}>
        {(['login', 'demo'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex:         1,
              padding:      '7px 0',
              borderRadius: 7,
              fontSize:     13,
              fontWeight:   mode === m ? 600 : 500,
              border:       'none',
              background:   mode === m ? C.surface : 'transparent',
              color:        mode === m ? C.primary : C.sec,
              boxShadow:    mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition:   'all 0.15s ease',
              cursor:       'pointer',
              fontFamily:   'Inter, system-ui, sans-serif',
            }}
          >
            {m === 'demo' ? 'Quick Demo' : 'Sign In'}
          </button>
        ))}
      </div>

      {/* ── Sign-in form ── */}
      {mode === 'login' && (
        <div style={{
          width:        '100%',
          maxWidth:     380,
          background:   C.surface,
          border:       `1px solid ${C.border}`,
          borderRadius: 16,
          padding:      28,
          boxShadow:    '0 4px 20px rgba(0,0,0,0.07)',
        }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
              Welcome back
            </div>
            <div style={{ fontSize: 13, color: C.sec, marginTop: 4 }}>
              Enter your credentials to continue
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 5 }}>
                Email
              </label>
              <input
                type="email" autoComplete="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@tmrw.com"
                onFocus={() => setInputFocus('email')}
                onBlur={() => setInputFocus(null)}
                style={inputStyle('email')}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 5 }}>
                Password
              </label>
              <input
                type="password" autoComplete="current-password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onFocus={() => setInputFocus('password')}
                onBlur={() => setInputFocus(null)}
                style={inputStyle('password')}
              />
            </div>

            {error && (
              <div style={{
                background: C.dangerBg, border: `1px solid ${C.dangerBorder}`,
                borderRadius: 8, padding: '10px 13px', marginBottom: 14,
              }}>
                <p style={{ fontSize: 12.5, color: C.danger, margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width:        '100%',
                padding:      '11px 0',
                background:   C.primary,
                color:        '#fff',
                border:       'none',
                borderRadius: 8,
                fontSize:     14,
                fontWeight:   600,
                cursor:       loading ? 'not-allowed' : 'pointer',
                opacity:      loading ? 0.7 : 1,
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          8,
                fontFamily:   'Inter, system-ui, sans-serif',
                transition:   'all 0.15s ease',
                boxShadow:    '0 2px 6px rgba(204,120,92,0.3)',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = C.primaryDark }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.primary }}
            >
              {loading && <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
            <span style={{ fontSize: 12.5, color: C.ter }}>No account? </span>
            <button
              onClick={() => setMode('demo')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 12.5, fontWeight: 600, color: C.primary, fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Try the demo →
            </button>
          </div>
        </div>
      )}

      {/* ── Demo role picker ── */}
      {mode === 'demo' && (
        <div style={{ width: '100%', maxWidth: 380 }}>
          <p style={{ fontSize: 12.5, color: C.ter, textAlign: 'center', marginBottom: 14 }}>
            Click any role to enter — no password needed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.id}
                onClick={() => demoLogin(u)}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          12,
                  background:   C.surface,
                  border:       `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding:      '12px 14px',
                  cursor:       'pointer',
                  textAlign:    'left',
                  width:        '100%',
                  transition:   'all 0.15s ease',
                  fontFamily:   'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor  = C.primary
                  el.style.background   = C.primaryLight
                  el.style.boxShadow    = '0 2px 8px rgba(204,120,92,0.12)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = C.border
                  el.style.background  = C.surface
                  el.style.boxShadow   = 'none'
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: u.avatarColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {u.initials}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: C.sec, marginTop: 2 }}>
                    {ROLE_LABEL[u.role]} · {u.department}
                  </div>
                </div>
                <ArrowRight size={14} color={C.ter} />
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
            <span style={{ fontSize: 12, color: C.ter }}>
              Also try: <code style={{ fontFamily: 'monospace', fontSize: 11.5, color: C.sec, background: C.bgSubtle, padding: '2px 6px', borderRadius: 4, border: `1px solid ${C.border}` }}>poc@demo.com / demo</code>
            </span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: C.ter, marginTop: 36 }}>
        Fabricate · Nautinati Sourcing Platform · AW 26
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
