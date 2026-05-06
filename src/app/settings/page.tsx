'use client'
import { useState } from 'react'
import {
  User, Bell, Lock, Building2, Users, Palette,
  CheckCircle2, ChevronRight, Info, Save
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { currentUser } from '@/lib/data'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { key: 'profile',       label: 'Profile',           icon: User },
  { key: 'notifications', label: 'Notifications',     icon: Bell },
  { key: 'team',          label: 'Team & Roles',       icon: Users },
  { key: 'brand',         label: 'Brand Settings',     icon: Building2 },
  { key: 'display',       label: 'Display',            icon: Palette },
  { key: 'security',      label: 'Security',           icon: Lock },
]

function Toggle2({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn('relative w-10 h-5.5 rounded-full transition-colors', enabled ? 'bg-violet-600' : 'bg-slate-200')}
    >
      <div className={cn('absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-all', enabled ? 'left-5' : 'left-0.5')} />
    </button>
  )
}

export default function SettingsPage() {
  const [section, setSection]   = useState('profile')
  const [saved,   setSaved]     = useState(false)

  // Notification prefs
  const [notifs, setNotifs] = useState({
    overdueEmail:     true,
    overdueApp:       true,
    dueTodayEmail:    false,
    dueTodayApp:      true,
    fiResultEmail:    true,
    fiResultApp:      true,
    costingEmail:     false,
    costingApp:       true,
    grnEmail:         false,
    grnApp:           true,
    weeklyDigest:     true,
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <Header title="Settings" subtitle={`${currentUser.name} · ${currentUser.brand}`} />
      <div className="px-6 py-6 flex gap-6">
        {/* Left nav */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left border-b border-slate-100 last:border-0',
                  section === key ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {section === key && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 max-w-2xl">
          {section === 'profile' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-5">Profile Information</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
                  <div className="w-16 h-16 rounded-2xl bg-violet-600 text-white text-2xl font-bold flex items-center justify-center">
                    {currentUser.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{currentUser.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{currentUser.role.replace('-', ' ')} · {currentUser.brand}</p>
                    <button className="mt-1.5 text-xs text-violet-600 hover:underline">Change avatar</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'First Name', value: currentUser.name.split(' ')[0] },
                    { label: 'Last Name', value: currentUser.name.split(' ').slice(1).join(' ') },
                    { label: 'Email', value: currentUser.email },
                    { label: 'Phone', value: '+91 98765 43210' },
                    { label: 'Role', value: currentUser.role, disabled: true },
                    { label: 'Brand', value: currentUser.brand, disabled: true },
                  ].map(({ label, value, disabled }) => (
                    <div key={label}>
                      <label className="text-xs font-semibold text-slate-700 mb-1.5 block">{label}</label>
                      <input
                        type="text"
                        defaultValue={value}
                        disabled={disabled}
                        className={cn('w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500', disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed')}
                      />
                      {disabled && <p className="text-xs text-slate-400 mt-1">Managed by admin</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-5">Notification Preferences</h2>

                {[
                  {
                    title: 'Overdue SubOrders',
                    desc: 'When a SubOrder misses its inward date',
                    emailKey: 'overdueEmail' as const,
                    appKey: 'overdueApp' as const,
                  },
                  {
                    title: 'Due Today',
                    desc: 'When a SubOrder is due today',
                    emailKey: 'dueTodayEmail' as const,
                    appKey: 'dueTodayApp' as const,
                  },
                  {
                    title: 'FI Result',
                    desc: 'When final inspection result is submitted',
                    emailKey: 'fiResultEmail' as const,
                    appKey: 'fiResultApp' as const,
                  },
                  {
                    title: 'Costing Updates',
                    desc: 'When a vendor submits or updates costing',
                    emailKey: 'costingEmail' as const,
                    appKey: 'costingApp' as const,
                  },
                  {
                    title: 'GRN Received',
                    desc: 'When warehouse records a GRN',
                    emailKey: 'grnEmail' as const,
                    appKey: 'grnApp' as const,
                  },
                ].map(({ title, desc, emailKey, appKey }) => (
                  <div key={title} className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-1.5">Email</p>
                        <Toggle2 enabled={notifs[emailKey]} onChange={v => setNotifs(p => ({ ...p, [emailKey]: v }))} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-1.5">In-app</p>
                        <Toggle2 enabled={notifs[appKey]} onChange={v => setNotifs(p => ({ ...p, [appKey]: v }))} />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Weekly Digest</p>
                    <p className="text-xs text-slate-500 mt-0.5">Sunday summary of your portfolio</p>
                  </div>
                  <Toggle2 enabled={notifs.weeklyDigest} onChange={v => setNotifs(p => ({ ...p, weeklyDigest: v }))} />
                </div>
              </div>
            </div>
          )}

          {section === 'team' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-5">Team Members</h2>
              <div className="space-y-2">
                {[
                  { name: 'Parthipan Kumar',  role: 'Sourcing POC',      initials: 'PK', email: 'parthipan@tmrw.com', status: 'active' },
                  { name: 'Ahul Singh',        role: 'Sourcing Manager',  initials: 'AS', email: 'ahul@tmrw.com',      status: 'active' },
                  { name: 'Megha Sharma',      role: 'Category Head',     initials: 'MS', email: 'megha@tmrw.com',     status: 'active' },
                  { name: 'Priya M',           role: 'Designer',          initials: 'PM', email: 'priya@tmrw.com',     status: 'active' },
                  { name: 'Rahul K',           role: 'Fit Technician',    initials: 'RK', email: 'rahul@tmrw.com',     status: 'active' },
                  { name: 'QA Inspector 1',    role: 'QA Inspector',      initials: 'QA', email: 'rakesh@tmrw.com',    status: 'active' },
                ].map(({ name, role, initials, email, status }) => (
                  <div key={email} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{name}</p>
                      <p className="text-xs text-slate-500">{email}</p>
                    </div>
                    <span className="text-xs text-slate-500 capitalize">{role}</span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-violet-300 text-sm text-violet-600 hover:bg-violet-50 font-medium">
                + Invite team member
              </button>
            </div>
          )}

          {section === 'brand' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-900">Brand Configuration</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Brand Name', value: 'Nautinati' },
                  { label: 'Parent Company', value: 'TMRW House of Brands' },
                  { label: 'Active Season', value: 'SS25' },
                  { label: 'Currency', value: 'INR (₹)' },
                  { label: 'Timezone', value: 'Asia/Kolkata (IST)' },
                  { label: 'Fiscal Year', value: 'April–March' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">{label}</label>
                    <input type="text" defaultValue={value} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                ))}
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700 flex gap-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Changes here affect all users in the Nautinati workspace. Super admin access required.
              </div>
            </div>
          )}

          {section === 'display' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-900">Display Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: 'Date Format', options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'D MMM YYYY'], default: 'D MMM YYYY' },
                  { label: 'Default Portfolio Sort', options: ['Inward Date', 'Status', 'Vendor', 'Style Code'], default: 'Inward Date' },
                  { label: 'Rows per page', options: ['20', '50', '100'], default: '50' },
                ].map(({ label, options, default: def }) => (
                  <div key={label}>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">{label}</label>
                    <select defaultValue={def} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                      {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-5">Security</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Current Password</label>
                    <input type="password" placeholder="••••••••" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">New Password</label>
                    <input type="password" placeholder="••••••••" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Confirm New Password</label>
                    <input type="password" placeholder="••••••••" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <button className="w-full py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">
                    Update Password
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Two-Factor Authentication</h3>
                <p className="text-xs text-slate-500 mb-4">Add an extra layer of security to your account</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Enable 2FA via SMS</span>
                  <Toggle2 enabled={false} onChange={() => {}} />
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          {section !== 'team' && (
            <div className="mt-5 flex items-center justify-end gap-3">
              {saved && (
                <span className="text-sm text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Saved!
                </span>
              )}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
