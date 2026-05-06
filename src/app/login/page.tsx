'use client'
import { useState, useEffect } from 'react'
import { Layers } from 'lucide-react'
import { login, getToken } from '@/lib/api/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (getToken()) {
      window.location.href = '/portfolio?tab=dashboard'
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await login(email, password)
      // Role-based redirect — use full reload so UserProvider re-reads localStorage
      const role = res.user.role
      if (role === 'vendor') {
        window.location.href = '/vendor-portal'
      } else if (role === 'qa-inspector' || role === 'qa-mgr') {
        window.location.href = '/inspections'
      } else if (role === 'warehouse-ops') {
        window.location.href = '/warehouse'
      } else if (role === 'sourcing-mis') {
        window.location.href = '/purchase-orders'
      } else if (role === 'designer' || role === 'fit-technician') {
        window.location.href = '/sampling'
      } else {
        window.location.href = '/portfolio?tab=dashboard'
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#101828' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-[#7F56D9] flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-tight">Fabricate</p>
            <p className="text-slate-500 text-xs">Order Management System</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-white font-semibold text-xl mb-1">Sign in</h1>
          <p className="text-slate-500 text-sm mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@tmrw.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-800 rounded-lg px-3 py-2.5">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7F56D9] hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Nautinati Sourcing Platform · AW 26
        </p>
      </div>
    </div>
  )
}
