'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type UserRole =
  | 'buying-poc'
  | 'sourcing-poc'
  | 'sourcing-mgr'
  | 'sourcing-mis'
  | 'qa-inspector'
  | 'qa-mgr'
  | 'warehouse-ops'
  | 'category-head'
  | 'vendor'
  | 'designer'
  | 'fit-technician'
  | 'super-admin'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  roleLabel: string
  department: string
  initials: string
  color: string // kept for UI, derived from role
  vendorId?: string | null
}

// ─── Role metadata (UI-only, no DB columns needed) ───────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  'buying-poc':      'Buying POC',
  'sourcing-poc':    'Sourcing POC',
  'sourcing-mgr':    'Sourcing Manager',
  'sourcing-mis':    'Sourcing MIS',
  'qa-inspector':    'QA Inspector',
  'qa-mgr':          'QA Manager',
  'warehouse-ops':   'Warehouse Ops',
  'category-head':   'Category Head',
  'vendor':          'Vendor Partner',
  'designer':        'Designer',
  'fit-technician':  'Fit Technician',
  'super-admin':     'Super Admin',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  'buying-poc':      'bg-purple-600',
  'sourcing-poc':    'bg-violet-600',
  'sourcing-mgr':    'bg-indigo-600',
  'sourcing-mis':    'bg-cyan-700',
  'qa-inspector':    'bg-emerald-600',
  'qa-mgr':          'bg-teal-600',
  'warehouse-ops':   'bg-orange-600',
  'category-head':   'bg-rose-600',
  'vendor':          'bg-cyan-600',
  'designer':        'bg-pink-600',
  'fit-technician':  'bg-violet-600',
  'super-admin':     'bg-slate-600',
}

// ─── Fallback (SSR / not authenticated) ──────────────────────────────────────

const FALLBACK_USER: UserProfile = {
  id: '',
  name: 'Guest',
  email: '',
  role: 'sourcing-poc',
  roleLabel: 'Sourcing POC',
  department: '',
  initials: 'GU',
  color: 'bg-slate-600',
  vendorId: null,
}

// ─── Build a UserProfile from stored auth data ────────────────────────────────

function buildProfile(raw: {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  initials: string | null
  vendorId: string | null
}): UserProfile {
  const role = raw.role as UserRole
  const initials = raw.initials
    ?? raw.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role,
    roleLabel: ROLE_LABELS[role] ?? raw.role,
    department: raw.department ?? '',
    initials,
    color: ROLE_COLORS[role] ?? 'bg-slate-600',
    vendorId: raw.vendorId,
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type UserContextType = {
  currentUser: UserProfile
}

const UserContext = createContext<UserContextType>({
  currentUser: FALLBACK_USER,
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(FALLBACK_USER)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fabricate-user')
      if (raw) {
        const parsed = JSON.parse(raw)
        setCurrentUser(buildProfile(parsed))
      }
    } catch {
      /* SSR / private mode / parse error */
    }
  }, [])

  return (
    <UserContext.Provider value={{ currentUser }}>
      {children}
    </UserContext.Provider>
  )
}

export const useCurrentUser = () => useContext(UserContext)
