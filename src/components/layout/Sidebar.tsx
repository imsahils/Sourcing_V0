'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSidebar } from '@/lib/sidebar-context'
import { useCurrentUser, type UserRole } from '@/lib/user-context'
import {
  Inbox, LayoutGrid, Building2, BarChart2, Settings,
  Layers, Users, ClipboardCheck, CheckSquare, Warehouse,
  Star, UserCog, ClipboardList, Plus, GitMerge,
  ChevronDown, Search, IndianRupee, LogOut,
  FlaskConical, Package, Factory, ScanLine, Truck,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type SubItem = { label: string; tab: string }

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  badge?: number | null
  section: 'poc' | 'mgr' | 'qa' | 'ops'
  visibleTo: UserRole[] | 'all'
  subItems?: SubItem[]
}

// ─── Nav Config ───────────────────────────────────────────────────────────────
const navItems: NavItem[] = [
  { label: 'My Queue',        href: '/queue',            icon: Inbox,         badge: 8, section: 'poc', visibleTo: ['sourcing-poc', 'sourcing-mgr'] },
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
  { label: 'Sampling',        href: '/sampling',         icon: FlaskConical,  section: 'poc', visibleTo: ['designer', 'fit-technician'] },
  { label: 'Purchase Orders', href: '/purchase-orders',  icon: Package,       section: 'poc', visibleTo: ['sourcing-mis'] },
  { label: 'Vendors',         href: '/vendors',          icon: Building2,     section: 'poc', visibleTo: ['sourcing-poc', 'sourcing-mgr'] },
  { label: 'Reports / DPR',   href: '/reports',          icon: BarChart2,     section: 'poc', visibleTo: ['sourcing-poc', 'sourcing-mgr', 'category-head', 'buying-poc'] },
  { label: 'Daily Production',href: '/reports?view=dpr', icon: Factory,       section: 'poc', visibleTo: ['vendor'] },
  { label: 'Order Costing',   href: '/reports?view=costing', icon: IndianRupee, section: 'poc', visibleTo: ['vendor'] },
  { label: 'RFQ',             href: '/vendor-portal?view=rfq',       icon: Inbox,         section: 'poc', visibleTo: ['vendor'] },
  { label: 'Pre-Production',  href: '/vendor-portal?view=pre-prod',  icon: FlaskConical,  section: 'poc', visibleTo: ['vendor'] },
  { label: 'My Orders',       href: '/vendor-portal?view=my-orders', icon: Package,       section: 'poc', visibleTo: ['vendor'] },
  { label: 'Manager Queue',   href: '/manager',          icon: Users,         section: 'mgr', visibleTo: ['sourcing-mgr'] },
  { label: 'Category Head',   href: '/category-head',    icon: Star,          section: 'mgr', visibleTo: ['sourcing-mgr', 'category-head'] },
  { label: 'Inspections',     href: '/inspections',      icon: Search,        section: 'qa',  visibleTo: ['qa-inspector', 'qa-mgr'] },
  { label: 'QA Dashboard',    href: '/qa',               icon: ClipboardCheck,section: 'qa',  visibleTo: ['qa-mgr'] },
  { label: 'Sample Approvals',href: '/approvals',        icon: CheckSquare,   section: 'qa',  visibleTo: ['qa-inspector', 'qa-mgr'] },
  { label: 'Warehouse / GRN', href: '/warehouse',        icon: Warehouse,     section: 'ops', visibleTo: ['warehouse-ops'] },
  { label: 'Vendor Portal',   href: '/vendor-portal',    icon: UserCog,       section: 'ops', visibleTo: ['warehouse-ops', 'sourcing-poc', 'sourcing-mgr'] },
]

const sectionMeta: Record<string, { label: string }> = {
  mgr: { label: 'Management' },
  qa:  { label: 'QA & Approvals' },
  ops: { label: 'Operations' },
}

const subIcons: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
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

// ─── Styles (inline with DS tokens) ──────────────────────────────────────────
const S = {
  aside: {
    position:    'fixed' as const,
    top:         0,
    left:        0,
    height:      '100%',
    width:       'var(--ds-sidebar-width)',
    background:  'var(--ds-sidebar-bg)',
    borderRight: '1px solid var(--ds-sidebar-border)',
    display:     'flex',
    flexDirection: 'column' as const,
    zIndex:      30,
    transition:  'transform 0.3s ease',
  },
  logoWrap: {
    padding:      '18px 18px 14px',
    borderBottom: '1px solid var(--ds-sidebar-border)',
    display:      'flex',
    alignItems:   'center',
    gap:          10,
  },
  logoIcon: {
    width:          34,
    height:         34,
    borderRadius:   10,
    background:     'var(--ds-primary)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  logoTitle: {
    fontSize:      15,
    fontWeight:    700,
    color:         'var(--ds-text)',
    letterSpacing: '-0.01em',
    lineHeight:    1.2,
  },
  logoSub: {
    fontSize: 11,
    color:    'var(--ds-text-tertiary)',
    marginTop: 1,
  },
  nav: {
    flex:       1,
    padding:    '10px 10px',
    overflowY:  'auto' as const,
  },
  sectionDivider: {
    marginTop: 12,
    marginBottom: 4,
    paddingLeft: 10,
    fontSize:   10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color:       'var(--ds-text-tertiary)',
  },
  sectionLine: {
    borderTop:    '1px solid var(--ds-sidebar-border)',
    marginBottom: 8,
    marginTop:    2,
  },
  navLink: (active: boolean): React.CSSProperties => ({
    display:        'flex',
    alignItems:     'center',
    gap:            9,
    padding:        '8px 10px',
    borderRadius:   'var(--ds-radius)',
    marginBottom:   2,
    textDecoration: 'none',
    background:     active ? 'var(--ds-sidebar-active-bg)' : 'transparent',
    color:          active ? 'var(--ds-sidebar-active)' : 'var(--ds-text-secondary)',
    fontWeight:     active ? 600 : 400,
    fontSize:       13.5,
    transition:     'all var(--ds-t-fast)',
    position:       'relative',
    cursor:         'pointer',
    borderLeft:     `2px solid ${active ? 'var(--ds-primary)' : 'transparent'}`,
  }),
  navLinkHover: {
    background: 'var(--ds-bg-subtle)',
    color:      'var(--ds-text)',
  },
  subLink: (active: boolean): React.CSSProperties => ({
    display:        'flex',
    alignItems:     'center',
    gap:            7,
    padding:        '7px 10px',
    borderRadius:   'var(--ds-radius-sm)',
    marginBottom:   1,
    textDecoration: 'none',
    background:     active ? 'var(--ds-primary-light)' : 'transparent',
    color:          active ? 'var(--ds-primary-dark)' : 'var(--ds-text-secondary)',
    fontWeight:     active ? 600 : 400,
    fontSize:       12.5,
    transition:     'all var(--ds-t-fast)',
    cursor:         'pointer',
  }),
  badge: (active: boolean): React.CSSProperties => ({
    padding:         '1px 6px',
    borderRadius:    'var(--ds-radius-full)',
    fontSize:        10.5,
    fontWeight:      700,
    background:      active ? 'var(--ds-primary)' : 'var(--ds-danger)',
    color:           '#fff',
    flexShrink:      0,
  }),
  chevron: (expanded: boolean): React.CSSProperties => ({
    width:      12,
    height:     12,
    flexShrink: 0,
    transition: 'transform 0.2s ease',
    transform:  expanded ? 'rotate(180deg)' : 'none',
  }),
  userWrap: {
    borderTop:  '1px solid var(--ds-sidebar-border)',
    padding:    '10px 12px',
    display:    'flex',
    alignItems: 'center',
    gap:        10,
  },
  avatar: (color: string): React.CSSProperties => ({
    width:          32,
    height:         32,
    borderRadius:   '50%',
    background:     color || 'var(--ds-primary)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          '#fff',
    fontSize:       12,
    fontWeight:     700,
    flexShrink:     0,
  }),
  userName: {
    fontSize:     13,
    fontWeight:   600,
    color:        'var(--ds-text)',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
    lineHeight:   1.2,
  },
  userRole: {
    fontSize: 11,
    color:    'var(--ds-text-tertiary)',
    marginTop: 1,
  },
  iconBtn: {
    background:  'none',
    border:      'none',
    padding:     6,
    borderRadius: 'var(--ds-radius-sm)',
    cursor:      'pointer',
    color:       'var(--ds-text-tertiary)',
    display:     'flex',
    alignItems:  'center',
    flexShrink:  0,
    transition:  'all var(--ds-t-fast)',
  },
}

// Avatar colour map — terra-cotta palette
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

// ─── Component ────────────────────────────────────────────────────────────────
export function Sidebar() {
  const path         = usePathname()
  const searchParams = useSearchParams()
  const currentTab   = searchParams.get('tab') ?? ''
  const { currentUser } = useCurrentUser()
  const { open: mobileOpen, close: closeMobile } = useSidebar()

  const role = currentUser.role

  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initial = navItems
      .filter(i => i.subItems && path.startsWith(i.href))
      .map(i => i.href)
    return new Set(initial)
  })

  const [hovered, setHovered] = useState<string | null>(null)

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
  const avatarColor = AVATAR_COLORS[role] ?? 'var(--ds-primary)'

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={closeMobile}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(28,25,23,0.5)',
            zIndex:     20,
            display:    'block',
          }}
          className="md:hidden"
        />
      )}

      <aside
        style={{
          ...S.aside,
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
        className={mobileOpen ? '' : '-translate-x-full md:translate-x-0'}
      >
        {/* ── Logo ── */}
        <div style={S.logoWrap}>
          <div style={S.logoIcon}>
            <Layers size={16} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={S.logoTitle}>Fabricate</div>
            <div style={S.logoSub}>Nautinati · AW 26</div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={S.nav}>
          {visibleItems.map((item, i) => {
            const active      = isActive(item.href)
            const Icon        = item.icon
            const prevItem    = visibleItems[i - 1]
            const showDivider = prevItem && prevItem.section !== item.section && !!sectionMeta[item.section]
            const isExpanded  = item.subItems ? openSections.has(item.href) : false
            const isHovered   = hovered === item.href

            return (
              <div key={item.href}>
                {showDivider && (
                  <div>
                    <div style={S.sectionLine} />
                    <div style={S.sectionDivider}>{sectionMeta[item.section]?.label}</div>
                  </div>
                )}

                {/* Main nav item */}
                <Link
                  href={item.subItems ? `${item.href}?tab=${item.subItems[0].tab}` : item.href}
                  onClick={closeMobile}
                  onMouseEnter={() => setHovered(item.href)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...S.navLink(active),
                    ...(isHovered && !active ? { background: 'var(--ds-bg-subtle)', color: 'var(--ds-text)' } : {}),
                  }}
                >
                  <Icon size={14} color="currentColor" strokeWidth={1.8} />
                  <span style={{ flex: 1, fontSize: 13 }}>{item.label}</span>

                  {item.badge != null && item.badge > 0 && (
                    <span style={S.badge(active)}>{item.badge}</span>
                  )}

                  {item.subItems && (
                    <span
                      onClick={e => toggleSection(e, item.href)}
                      style={{ padding: 2, borderRadius: 4, cursor: 'pointer', display: 'flex' }}
                    >
                      <ChevronDown
                        size={12}
                        color="var(--ds-text-tertiary)"
                        style={S.chevron(isExpanded)}
                      />
                    </span>
                  )}

                  {active && !item.subItems && (
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--ds-primary)', flexShrink: 0,
                    }} />
                  )}
                </Link>

                {/* Sub-items */}
                {isExpanded && item.subItems && (
                  <div style={{ marginLeft: 20, marginBottom: 4 }}>
                    {item.subItems.map(sub => {
                      const SubIcon   = subIcons[sub.tab]
                      const isSubActive = path.startsWith(item.href) && currentTab === sub.tab
                      return (
                        <Link
                          key={sub.tab}
                          href={`${item.href}?tab=${sub.tab}`}
                          onClick={closeMobile}
                          style={S.subLink(isSubActive)}
                          onMouseEnter={e => { if (!isSubActive) { (e.currentTarget as HTMLElement).style.background = 'var(--ds-bg-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--ds-text)' } }}
                          onMouseLeave={e => { if (!isSubActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-secondary)' } }}
                        >
                          {SubIcon && <SubIcon size={12} color="currentColor" strokeWidth={1.8} />}
                          <span style={{ fontSize: 12.5 }}>{sub.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Settings */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--ds-sidebar-border)', paddingTop: 10 }}>
            <Link
              href="/settings"
              onClick={closeMobile}
              style={S.navLink(path === '/settings')}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ds-bg-subtle)' }}
              onMouseLeave={e => { if (path !== '/settings') (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Settings size={14} color="currentColor" strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 13 }}>Settings</span>
            </Link>
          </div>
        </nav>

        {/* ── User Footer ── */}
        <div style={S.userWrap}>
          <div style={S.avatar(avatarColor)}>
            {currentUser.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.userName}>{currentUser.name}</div>
            <div style={S.userRole}>{currentUser.roleLabel}</div>
          </div>
          <button
            onClick={() => { import('@/lib/api/auth').then(m => m.logout()) }}
            style={S.iconBtn}
            title="Log out"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ds-danger-bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--ds-danger)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-tertiary)' }}
          >
            <LogOut size={14} strokeWidth={1.8} />
          </button>
        </div>
      </aside>
    </>
  )
}
