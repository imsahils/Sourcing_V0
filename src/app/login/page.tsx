'use client'
import { useState, useEffect } from 'react'
import { Layers, ArrowRight, Loader2 } from 'lucide-react'
import { login, getToken } from '@/lib/api/auth'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/user-context'

// ─── Demo users — used when backend is unavailable ───────────────────────────

const DEMO_USERS: {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  initials: string
  department: string
  color: string
  redirect: string
}[] = [
  { id: 'u1', name: 'Parthipan Kumar',  email: 'poc@demo.com',       password: 'demo', role: 'sourcing-poc',  initials: 'PK', department: 'Sourcing',   color: 'bg-violet-600', redirect: '/portfolio?tab=dashboard' },
  { id: 'u2', name: 'Priya Menon',      email: 'manager@demo.com',   password: 'demo', role: 'sourcing-mgr',  initials: 'PM', department: 'Sourcing',   color: 'bg-indigo-600', redirect: '/portfolio?tab=dashboard' },
  { id: 'u3', name: 'Megha Sharma',     email: 'category@demo.com',  password: 'demo', role: 'category-head', initials: 'MS', department: 'Buying',     color: 'bg-rose-600',   redirect: '/category-head' },
  { id: 'u4', name: 'Rahul Desai',      email: 'buyer@demo.com',     password: 'demo', role: 'buying-poc',    initials: 'RD', department: 'Buying',     color: 'bg-purple-600', redirect: '/order-management?tab=grid' },
  { id: 'u5', name: 'Ankit Verma',      email: 'qa@demo.com',        password: 'demo', role: 'qa-mgr',        initials: 'AV', department: 'QA',         color: 'bg-teal-600',   redirect: '/qa' },
  { id: 'u6', name: 'Sunit Jain',       email: 'warehouse@demo.com', password: 'demo', role: 'warehouse-ops', initials: 'SJ', department: 'Warehouse',  color: 'bg-orange-600', redirect: '/warehouse' },
  { id: 'u7', name: 'Bharti Apparels',  email: 'vendor@demo.com',    password: 'demo', role: 'vendor',        initials: 'BA', department: 'Vendor',     color: 'bg-cyan-600',   redirect: '/vendor-portal' },
  { id: 'u8', name: 'Riya Kapoor',      email: 'mis@demo.com',       password: 'demo', role: 'sourcing-mis',  initials: 'RK', department: 'Sourcing',   color: 'bg-cyan-700',   redirect: '/purchase-orders' },
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
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    initials: user.initials,
    vendorId: null,
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

  useEffect(() => {
    if (getToken()) window.location.href = '/portfolio?tab=dashboard'
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // ── Check demo credentials first ──────────────────────────────────────────
    const demoUser = DEMO_USERS.find(u => u.email === email && u.password === password)
    if (demoUser) {
      demoLogin(demoUser)
      return
    }

    // ── Try real API ──────────────────────────────────────────────────────────
    try {
      const res = await login(email, password)
      const role = res.user.role as UserRole
      const redirectMap: Partial<Record<UserRole, string>> = {
        'vendor':         '/vendor-portal',
        'qa-inspector':   '/inspections',
        'qa-mgr':         '/inspections',
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: '#0d1117' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#7F56D9] flex items-center justify-center">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-xl leading-tight">Fabricate</p>
          <p className="text-slate-500 text-xs">Sourcing Order Management · Nautinati AW 26</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl mb-6 w-full max-w-sm">
        {(['login', 'demo'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn('flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
              mode === m
                ? 'bg-[#7F56D9] text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            )}>
            {m === 'demo' ? 'Quick Demo' : 'Sign In'}
          </button>
        ))}
      </div>

      {/* ── Sign-in form ─────────────────────────────────────────────────────── */}
      {mode === 'login' && (
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-white font-semibold text-lg mb-1">Welcome back</h1>
          <p className="text-slate-500 text-xs mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input type="email" autoComplete="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@tmrw.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input type="password" autoComplete="current-password" required value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all" />
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-800 rounded-lg px-3 py-2.5">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#7F56D9] hover:bg-violet-600 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-xs">No account? &nbsp;
              <button onClick={() => setMode('demo')} className="text-violet-400 hover:text-violet-300 font-medium">
                Try the demo →
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── Quick demo role picker ────────────────────────────────────────────── */}
      {mode === 'demo' && (
        <div className="w-full max-w-sm space-y-2">
          <p className="text-slate-500 text-xs text-center mb-4">
            Click any role to enter as that user — no password needed
          </p>
          {DEMO_USERS.map(u => (
            <button key={u.id} onClick={() => demoLogin(u)}
              className="w-full flex items-center gap-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 rounded-xl px-4 py-3.5 transition-all group text-left">
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', u.color)}>
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{u.name}</p>
                <p className="text-xs text-slate-500">{ROLE_LABEL[u.role]} · {u.department}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
            </button>
          ))}

          <div className="mt-4 pt-4 border-t border-slate-800 text-center">
            <p className="text-slate-600 text-xs">
              Demo credentials: <span className="text-slate-400 font-mono">poc@demo.com / demo</span>
            </p>
          </div>
        </div>
      )}

      <p className="text-slate-700 text-xs mt-8">
        Fabricate · Nautinati Sourcing Platform · AW 26
      </p>
    </div>
  )
}
