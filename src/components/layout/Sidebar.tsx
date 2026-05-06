'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSidebar } from '@/lib/sidebar-context'
import { cn } from '@/lib/utils'
import { useCurrentUser, type UserRole } from '@/lib/user-context'
import {
  Inbox, LayoutGrid, Building2, BarChart2, Settings,
  Layers, Users, ClipboardCheck, CheckSquare, Warehouse,
  Star, UserCog, ClipboardList, Plus, GitMerge,
  ChevronDown, Search, IndianRupee, LogOut, Sun, Moon,
  FlaskConical, Package, Factory, ScanLine, Truck,
} from 'lucide-react'
import { useTheme } from '@/lib/theme-context'

// ─── Types ────────────────────────────────────────────────────────────────────
type SubItem = {
  label: string
  tab: string
}

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | null
  section: 'poc' | 'mgr' | 'qa' | 'ops'
  visibleTo: UserRole[] | 'all'
  subItems?: SubItem[]
}

// ─── Nav Config ───────────────────────────────────────────────────────────────
const navItems: NavItem[] = [
  // POC
  {
    label: 'My Queue', href: '/queue', icon: Inbox, badge: 8, section: 'poc',
    visibleTo: ['sourcing-poc', 'sourcing-mgr'],
  },
  {
    label: 'My Portfolio', href: '/portfolio', icon: LayoutGrid, section: 'poc',
    visibleTo: ['sourcing-poc', 'sourcing-mgr'],
    subItems: [
      { label: 'Dashboard',         tab: 'dashboard'      },
      { label: 'Vendor Assignment', tab: 'vendor-assign'  },
      { label: 'Costing & PO',      tab: 'costing'        },
      { label: 'Pre-production',    tab: 'pre-production' },
      { label: 'Production',        tab: 'production'     },
      { label: 'Inspection',        tab: 'inspection'     },
      { label: 'ASN',               tab: 'asn'            },
    ],
  },
  {
    label: 'OTB Management', href: '/order-management', icon: ClipboardList, section: 'poc',
    visibleTo: ['buying-poc', 'sourcing-poc', 'sourcing-mgr', 'qa-mgr', 'category-head', 'warehouse-ops'],
    subItems: [
      { label: 'Order Grid',       tab: 'grid'       },
      { label: 'New Order',        tab: 'new'        },
      { label: 'Order Assignment', tab: 'assignment' },
    ],
  },
  {
    label: 'Sampling', href: '/sampling', icon: FlaskConical, section: 'poc',
    visibleTo: ['designer', 'fit-technician'],
  },
  {
    label: 'Purchase Orders', href: '/purchase-orders', icon: Package, section: 'poc',
    visibleTo: ['sourcing-mis'],
  },
  {
    label: 'Vendors', href: '/vendors', icon: Building2, section: 'poc',
    visibleTo: ['sourcing-poc', 'sourcing-mgr'],
  },
  {
    label: 'Reports / DPR', href: '/reports', icon: BarChart2, section: 'poc',
    visibleTo: ['sourcing-poc', 'sourcing-mgr', 'category-head', 'buying-poc'],
  },
  // Vendor-only split items
  {
    label: 'Daily Production', href: '/reports?view=dpr', icon: Factory, section: 'poc',
    visibleTo: ['vendor'],
  },
  {
    label: 'Order Costing', href: '/reports?view=costing', icon: IndianRupee, section: 'poc',
    visibleTo: ['vendor'],
  },
  {
    label: 'Pre-Production', href: '/vendor-portal', icon: FlaskConical, section: 'poc',
    visibleTo: ['vendor'],
  },

  // Management
  {
    label: 'Manager Queue', href: '/manager', icon: Users, section: 'mgr',
    visibleTo: ['sourcing-mgr'],
  },
  {
    label: 'Category Head', href: '/category-head', icon: Star, section: 'mgr',
    visibleTo: ['sourcing-mgr', 'category-head'],
  },

  // QA
  {
    label: 'Inspections', href: '/inspections', icon: Search, section: 'qa',
    visibleTo: ['qa-inspector', 'qa-mgr'],
  },
  {
    label: 'QA Dashboard', href: '/qa', icon: ClipboardCheck, section: 'qa',
    visibleTo: ['qa-mgr'],
  },
  {
    label: 'Sample Approvals', href: '/approvals', icon: CheckSquare, section: 'qa',
    visibleTo: ['qa-inspector', 'qa-mgr'],
  },

  // Ops
  {
    label: 'Warehouse / GRN', href: '/warehouse', icon: Warehouse, section: 'ops',
    visibleTo: ['warehouse-ops'],
  },
  {
    label: 'Vendor Portal', href: '/vendor-portal', icon: UserCog, section: 'ops',
    visibleTo: ['warehouse-ops', 'sourcing-poc', 'sourcing-mgr'],
  },
]

const sectionMeta: Record<string, { label: string }> = {
  mgr: { label: 'Management' },
  qa:  { label: 'QA & Approvals' },
  ops: { label: 'Operations' },
}

// Sub-item icon map
const subIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard:        LayoutGrid,
  grid:             LayoutGrid,
  new:              Plus,
  assignment:       GitMerge,
  costing:          IndianRupee,
  'vendor-assign':  Building2,
  'pre-production': FlaskConical,
  production:       Factory,
  inspection:       ScanLine,
  asn:              Truck,
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Sidebar() {
  const path           = usePathname()
  const searchParams   = useSearchParams()
  const currentTab     = searchParams.get('tab') ?? ''
  const { currentUser } = useCurrentUser()
  const { open: mobileOpen, close: closeMobile } = useSidebar()
  const { theme, toggleTheme } = useTheme()

  const role = currentUser.role

  // Independent open/close state per section — not tied to active route
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    // Pre-open whichever section is currently active on first load
    const initial = navItems
      .filter(i => i.subItems && path.startsWith(i.href))
      .map(i => i.href)
    return new Set(initial)
  })

  // When the path changes to a new section, auto-open it (but never auto-close others)
  useEffect(() => {
    const activeHref = navItems.find(i => i.subItems && path.startsWith(i.href))?.href
    if (activeHref) {
      setOpenSections(prev => {
        if (prev.has(activeHref)) return prev
        return new Set([...prev, activeHref])
      })
    }
  }, [path])

  const toggleSection = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    e.stopPropagation()
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  const isVisible = (item: NavItem): boolean => {
    if (item.visibleTo === 'all') return true
    return (item.visibleTo as UserRole[]).includes(role)
  }

  const isActive = (href: string) => {
    if (href === '/queue') return path === '/' || path === '/queue'
    if (href.includes('?')) {
      const [hrefPath, hrefQuery] = href.split('?')
      const hrefParams = new URLSearchParams(hrefQuery)
      return (
        path.startsWith(hrefPath) &&
        [...hrefParams.entries()].every(([k, v]) => searchParams.get(k) === v)
      )
    }
    return path.startsWith(href)
  }

  const visibleItems = navItems.filter(isVisible)

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={closeMobile}
        />
      )}

    <aside
      className={cn(
        'fixed top-0 left-0 h-full w-60 flex flex-col z-30 border-r transition-transform duration-300',
        'bg-white dark:bg-[#101828] border-slate-200 dark:border-slate-800',
        // Mobile: hidden by default, slide in when open
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: always visible
        'md:translate-x-0'
      )}
    >
      {/* ── Logo ── */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7F56D9] flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-slate-900 dark:text-white font-semibold text-sm leading-tight">Fabricate</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs">Nautinati · AW 26</p>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {visibleItems.map((item, i) => {
          const active = isActive(item.href)
          const Icon   = item.icon

          // Determine if section divider is needed
          const prevItem  = visibleItems[i - 1]
          const showDivider =
            prevItem &&
            prevItem.section !== item.section &&
            !!sectionMeta[item.section]

          // Expanded = has been opened via state, NOT tied to active route
          const isExpanded = item.subItems ? openSections.has(item.href) : false

          return (
            <div key={item.href}>
              {showDivider && (
                <div className="mt-3 mb-1.5">
                  <div className="border-t border-slate-200 dark:border-slate-800 mb-2" />
                  <p className="text-xs text-slate-400 dark:text-slate-600 font-semibold uppercase tracking-wider px-3">
                    {sectionMeta[item.section]?.label}
                  </p>
                </div>
              )}

              {/* Main nav item */}
              <Link
                href={item.subItems ? `${item.href}?tab=${item.subItems[0].tab}` : item.href}
                onClick={closeMobile}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 mb-0.5',
                  active
                    ? 'bg-violet-50 dark:bg-violet-600/20 text-violet-700 dark:text-white border-l-2 border-violet-500 dark:border-[#7F56D9]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 border-l-2 border-transparent'
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 font-medium text-xs">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-xs font-bold',
                    active ? 'bg-violet-500 text-white' : 'bg-red-500/80 text-white'
                  )}>
                    {item.badge}
                  </span>
                )}
                {/* Chevron: click toggles only this section, doesn't navigate */}
                {item.subItems && (
                  <span
                    onClick={e => toggleSection(e, item.href)}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ChevronDown className={cn(
                      'w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform duration-200',
                      isExpanded && 'rotate-180'
                    )} />
                  </span>
                )}
              </Link>

              {/* Sub-items — visible whenever section is open, regardless of route */}
              {isExpanded && item.subItems && (
                <div className="ml-6 mb-1 space-y-0.5">
                  {item.subItems.map(sub => {
                    const SubIcon = subIcons[sub.tab]
                    const isSubActive = path.startsWith(item.href) && currentTab === sub.tab
                    return (
                      <Link
                        key={sub.tab}
                        href={`${item.href}?tab=${sub.tab}`}
                        onClick={closeMobile}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-150 border-l-2',
                          isSubActive
                            ? 'bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 border-violet-400 dark:border-violet-500'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                        )}
                      >
                        {SubIcon && <SubIcon className="w-3 h-3 flex-shrink-0" />}
                        <span className="font-medium">{sub.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Settings */}
        <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 border-l-2',
              path === '/settings'
                ? 'bg-violet-50 dark:bg-violet-600/20 text-violet-700 dark:text-white border-violet-500'
                : 'text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-300 border-transparent'
            )}
          >
            <Settings className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium text-xs">Settings</span>
          </Link>
        </div>
      </nav>

      {/* ── User info + Logout ── */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', currentUser.color)}>
          {currentUser.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-white text-xs font-medium truncate">{currentUser.name}</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs truncate">{currentUser.roleLabel}</p>
        </div>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark'
            ? <Sun className="w-3.5 h-3.5" />
            : <Moon className="w-3.5 h-3.5" />
          }
        </button>
        <button
          onClick={() => { import('@/lib/api/auth').then(m => m.logout()) }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          title="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
    </>
  )
}
