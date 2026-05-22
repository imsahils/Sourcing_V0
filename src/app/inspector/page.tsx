'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapPin, Calendar, Clock, Package, Building2, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, PlayCircle, FileText,
  CalendarClock, CalendarX, CalendarCheck, Hourglass, Layers,
  X, Send, AlertTriangle, Check,
} from 'lucide-react'
import {
  type ScheduleTab,
  type InspectionRequest,
  type InspectionStatus,
  TAB_LABELS,
  getInspectionsForTab,
  getTabCounts,
  formatScheduledDate,
  relativeDate,
} from '@/lib/inspection-mock'

// ─── Status display config ────────────────────────────────────────────────────

type StatusVisual = {
  label:     string
  bg:        string
  color:     string
  border:    string
  icon:      React.ComponentType<{ size?: number; strokeWidth?: number }>
}

const STATUS_VISUALS: Record<InspectionStatus, StatusVisual> = {
  pending_assignment: {
    label: 'Awaiting Assignment',
    bg: 'var(--ds-bg-subtle)', color: 'var(--ds-text-secondary)', border: 'var(--ds-border)',
    icon: Hourglass,
  },
  unscheduled: {
    label: 'Date Pending',
    bg: 'var(--ds-bg-subtle)', color: 'var(--ds-text-secondary)', border: 'var(--ds-border)',
    icon: CalendarClock,
  },
  pending_confirmation: {
    label: 'Confirm Date',
    bg: 'var(--ds-warning-bg)', color: 'var(--ds-warning)', border: 'var(--ds-warning-border)',
    icon: CalendarClock,
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'var(--ds-info-bg)', color: 'var(--ds-info)', border: 'var(--ds-info-border)',
    icon: CalendarCheck,
  },
  in_progress: {
    label: 'In Progress',
    bg: 'var(--ds-primary-light)', color: 'var(--ds-primary-dark)', border: '#F3C9B7',
    icon: PlayCircle,
  },
  on_site_in_progress: {
    label: 'On-Site',
    bg: 'var(--ds-primary-light)', color: 'var(--ds-primary-dark)', border: '#F3C9B7',
    icon: PlayCircle,
  },
  submitted: {
    label: 'Submitted',
    bg: 'var(--ds-info-bg)', color: 'var(--ds-info)', border: 'var(--ds-info-border)',
    icon: FileText,
  },
  passed: {
    label: 'Passed',
    bg: 'var(--ds-success-bg)', color: 'var(--ds-success)', border: 'var(--ds-success-border)',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    bg: 'var(--ds-danger-bg)', color: 'var(--ds-danger)', border: 'var(--ds-danger-border)',
    icon: XCircle,
  },
  on_hold: {
    label: 'On Hold',
    bg: 'var(--ds-warning-bg)', color: 'var(--ds-warning)', border: 'var(--ds-warning-border)',
    icon: AlertCircle,
  },
  not_ready: {
    label: 'Vendor Not Ready',
    bg: 'var(--ds-danger-bg)', color: 'var(--ds-danger)', border: 'var(--ds-danger-border)',
    icon: CalendarX,
  },
  missed: {
    label: 'Missed',
    bg: 'var(--ds-danger-bg)', color: 'var(--ds-danger)', border: 'var(--ds-danger-border)',
    icon: CalendarX,
  },
  rescheduled: {
    label: 'Rescheduled',
    bg: 'var(--ds-warning-bg)', color: 'var(--ds-warning)', border: 'var(--ds-warning-border)',
    icon: CalendarClock,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'var(--ds-bg-subtle)', color: 'var(--ds-text-secondary)', border: 'var(--ds-border)',
    icon: XCircle,
  },
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { key: ScheduleTab; shortLabel: string }[] = [
  { key: 'today',                shortLabel: 'Today' },
  { key: 'upcoming',             shortLabel: 'Upcoming' },
  { key: 'pending_confirmation', shortLabel: 'Pending' },
  { key: 'unscheduled',          shortLabel: 'Unscheduled' },
  { key: 'completed',            shortLabel: 'Completed' },
  { key: 'missed',               shortLabel: 'Missed' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function InspectorSchedulePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ScheduleTab>('today')
  const [actionFor, setActionFor] = useState<InspectionRequest | null>(null)
  const [flashConfirmedId, setFlashConfirmedId] = useState<string | null>(null)

  const counts = useMemo(() => getTabCounts(), [])
  const rows = useMemo(() => getInspectionsForTab(activeTab), [activeTab])

  // Status → action policy:
  //   pending_confirmation       → opens ActionSheet (Confirm / Flag Conflict)
  //   missed / not_ready / resch → opens ActionSheet (Propose New Date)
  //   everything else (Start, Continue, View Report, View Details) → navigate
  const onCardAction = (r: InspectionRequest) => {
    if (r.status === 'pending_confirmation'
        || r.status === 'missed'
        || r.status === 'not_ready'
        || r.status === 'rescheduled') {
      setActionFor(r)
    } else {
      router.push(`/inspector/inspect/${r.id}`)
    }
  }

  return (
    <>
      {/* Page title block */}
      <div style={{ padding: '16px 16px 8px' }}>
        <h1 style={{
          fontSize:    20,
          fontWeight:  700,
          color:       'var(--ds-text)',
          letterSpacing: '-0.02em',
          margin:      0,
        }}>
          My Schedule
        </h1>
        <p style={{
          fontSize:  12.5,
          color:     'var(--ds-text-secondary)',
          marginTop: 3,
          marginBottom: 0,
        }}>
          {counts.today} active today · {counts.upcoming} upcoming · {counts.pending_confirmation} need confirmation
        </p>
      </div>

      {/* Horizontally scrollable tab bar */}
      <TabBar
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        counts={counts}
      />

      {/* Scrollable card list */}
      <div style={{
        flex:    1,
        padding: '8px 12px 80px',
        background: 'var(--ds-bg)',
      }}>
        {rows.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          rows.map(r => (
            <InspectionCard
              key={r.id}
              request={r}
              tab={activeTab}
              onAction={() => onCardAction(r)}
              flash={flashConfirmedId === r.id}
            />
          ))
        )}
      </div>

      {/* Action Sheet overlay */}
      {actionFor && (
        <ActionSheet
          request={actionFor}
          onClose={() => setActionFor(null)}
          onConfirmed={(id) => {
            setFlashConfirmedId(id)
            setActionFor(null)
            // Clear the flash highlight after 2s
            setTimeout(() => setFlashConfirmedId(prev => (prev === id ? null : prev)), 2000)
          }}
        />
      )}
    </>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs:    { key: ScheduleTab; shortLabel: string }[]
  active:  ScheduleTab
  onChange: (k: ScheduleTab) => void
  counts:  Record<ScheduleTab, number>
}) {
  return (
    <div
      style={{
        position:   'sticky',
        top:        62,
        zIndex:     5,
        background: 'var(--ds-bg)',
        borderBottom: '1px solid var(--ds-border)',
        padding:    '8px 12px',
        overflowX:  'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
        {tabs.map(t => {
          const isActive = t.key === active
          const count = counts[t.key]
          const hasUrgentDot = (t.key === 'pending_confirmation' && count > 0)
                            || (t.key === 'missed' && count > 0)
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              style={{
                position:     'relative',
                padding:      '8px 14px',
                borderRadius: 999,
                border:       isActive
                  ? '1px solid var(--ds-primary)'
                  : '1px solid var(--ds-border)',
                background:   isActive
                  ? 'var(--ds-primary-light)'
                  : 'var(--ds-surface)',
                color:        isActive ? 'var(--ds-primary-dark)' : 'var(--ds-text-secondary)',
                fontSize:     13,
                fontWeight:   isActive ? 600 : 500,
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                whiteSpace:   'nowrap',
                transition:   'all 0.12s',
                flexShrink:   0,
              }}
            >
              <span>{t.shortLabel}</span>
              <span
                style={{
                  minWidth:    18,
                  padding:     '1px 6px',
                  background:  isActive ? 'var(--ds-primary)' : 'var(--ds-bg-subtle)',
                  color:       isActive ? '#fff' : 'var(--ds-text-tertiary)',
                  borderRadius: 999,
                  fontSize:    11,
                  fontWeight:  600,
                  textAlign:   'center',
                  lineHeight:  '14px',
                }}
              >
                {count}
              </span>
              {hasUrgentDot && (
                <span
                  style={{
                    position:    'absolute',
                    top:         -2,
                    right:       -2,
                    width:       8,
                    height:      8,
                    borderRadius: '50%',
                    background:  'var(--ds-danger)',
                    border:      '1.5px solid var(--ds-bg)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Inspection card ──────────────────────────────────────────────────────────

function InspectionCard({
  request, tab, onAction, flash,
}: {
  request: InspectionRequest
  tab: ScheduleTab
  onAction: () => void
  flash?: boolean
}) {
  const visual = STATUS_VISUALS[request.status]
  const StatusIcon = visual.icon

  // Compute card emphasis: 'today' tab gets prominent treatment for the
  // active scheduled / in-progress cards.
  const isActive = tab === 'today'
  const isInProgress = request.status === 'in_progress' || request.status === 'on_site_in_progress'

  const cta = getPrimaryCta(request, tab, onAction)

  return (
    <article
      style={{
        background:    flash ? 'var(--ds-success-bg)' : 'var(--ds-surface)',
        border:        flash
          ? '1px solid var(--ds-success-border)'
          : isActive && isInProgress
            ? '2px solid var(--ds-primary)'
            : '1px solid var(--ds-border)',
        borderRadius:  14,
        padding:       14,
        marginBottom:  10,
        boxShadow:     flash
          ? '0 2px 10px rgba(46,125,82,0.18)'
          : isActive && isInProgress
            ? '0 4px 14px rgba(204,120,92,0.18)'
            : '0 1px 2px rgba(28,25,23,0.04)',
        position:      'relative',
        overflow:      'hidden',
        transition:    'background 0.3s, border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Header row: status badge + report number */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        justifyContent: 'space-between',
        marginBottom:  10,
        gap:           8,
      }}>
        <span
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            gap:           5,
            padding:       '3px 9px',
            borderRadius:  999,
            background:    visual.bg,
            color:         visual.color,
            border:        `1px solid ${visual.border}`,
            fontSize:      11,
            fontWeight:    600,
            letterSpacing: '0.01em',
          }}
        >
          <StatusIcon size={12} strokeWidth={2.2} />
          {visual.label}
        </span>
        <span style={{
          fontSize:   10.5,
          color:      'var(--ds-text-tertiary)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '-0.01em',
        }}>
          {request.reportNumber}
          {request.round > 1 && (
            <span style={{
              marginLeft: 4,
              padding: '1px 5px',
              background: 'var(--ds-warning-bg)',
              color: 'var(--ds-warning)',
              borderRadius: 4,
              fontWeight: 700,
            }}>R{request.round}</span>
          )}
        </span>
      </div>

      {/* Style + colour */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize:   15,
          fontWeight: 600,
          color:      'var(--ds-text)',
          lineHeight: 1.3,
          letterSpacing: '-0.005em',
        }}>
          {request.styleName}
        </div>
        <div style={{
          fontSize:   12,
          color:      'var(--ds-text-secondary)',
          marginTop:  2,
          display:    'flex',
          gap:        8,
          flexWrap:   'wrap',
        }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>
            {request.styleCode}
          </span>
          <span style={{ color: 'var(--ds-text-tertiary)' }}>·</span>
          <span>{request.colours.join(' / ')}</span>
        </div>
      </div>

      {/* Vendor + location row */}
      <DetailRow icon={Building2} label={request.vendorName} sub={request.vendorPremise} />

      {/* Date + time window */}
      {(request.scheduledDate || request.readyDate) && (
        <DetailRow
          icon={Calendar}
          label={formatScheduledDate(request.scheduledDate || request.readyDate)}
          sub={[
            relativeDate(request.scheduledDate || request.readyDate),
            request.timeWindow,
          ].filter(Boolean).join(' · ')}
        />
      )}

      {/* Qty + PO */}
      <DetailRow
        icon={Package}
        label={`${request.inspectionRequestedQtyTotal.toLocaleString('en-IN')} pcs · PO ${request.poNumber}`}
        sub={request.colours.length > 1
          ? `${request.colours.length} colours · combined AQL`
          : '1 colour'}
      />

      {/* On-behalf-of badge */}
      {request.onBehalfOfVendorId && (
        <div style={{
          marginTop:   8,
          padding:     '6px 9px',
          background:  'var(--ds-info-bg)',
          border:      '1px solid var(--ds-info-border)',
          borderRadius: 8,
          fontSize:    11.5,
          color:       'var(--ds-info)',
          display:     'flex',
          alignItems:  'center',
          gap:         6,
        }}>
          <Layers size={11} strokeWidth={2.2} />
          Raised by {request.sourcingPocName} on behalf of vendor
        </div>
      )}

      {/* Notes (e.g. re-inspection context, vendor not ready reason) */}
      {request.notes && (
        <div style={{
          marginTop:   8,
          padding:     '6px 9px',
          background:  'var(--ds-bg-subtle)',
          borderRadius: 8,
          fontSize:    11.5,
          color:       'var(--ds-text-secondary)',
          fontStyle:   'italic',
        }}>
          {request.notes}
        </div>
      )}

      {/* CTA */}
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          style={{
            marginTop:    12,
            width:        '100%',
            padding:      '11px 14px',
            border:       cta.variant === 'primary'
              ? 'none'
              : '1px solid var(--ds-border)',
            background:   cta.variant === 'primary'
              ? 'var(--ds-primary)'
              : 'var(--ds-surface)',
            color:        cta.variant === 'primary'
              ? '#fff'
              : 'var(--ds-text)',
            borderRadius: 10,
            fontSize:     14,
            fontWeight:   600,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            gap:          6,
            boxShadow:    cta.variant === 'primary'
              ? '0 1px 3px rgba(204,120,92,0.35)'
              : 'none',
          }}
        >
          {cta.label}
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      )}
    </article>
  )
}

// ─── Card detail row ──────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  sub?: string
}) {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'flex-start',
      gap:        9,
      padding:    '5px 0',
    }}>
      <div style={{
        width: 22, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ds-text-tertiary)',
        flexShrink: 0,
        marginTop: 1,
      }}>
        <Icon size={14} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:   13,
          color:      'var(--ds-text)',
          fontWeight: 500,
          lineHeight: 1.3,
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize:  11.5,
            color:     'var(--ds-text-tertiary)',
            marginTop: 1,
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Primary CTA logic per status ─────────────────────────────────────────────

function getPrimaryCta(
  request: InspectionRequest,
  tab: ScheduleTab,
  open: () => void,
): { label: string; variant: 'primary' | 'secondary'; onClick: () => void } | null {
  const { status } = request

  if (status === 'in_progress' || status === 'on_site_in_progress') {
    return { label: 'Continue Inspection', variant: 'primary', onClick: open }
  }
  if (status === 'scheduled' && tab === 'today') {
    return { label: 'Start Inspection', variant: 'primary', onClick: open }
  }
  if (status === 'pending_confirmation') {
    return { label: 'Confirm Date', variant: 'primary', onClick: open }
  }
  if (status === 'scheduled' && tab === 'upcoming') {
    return { label: 'View Details', variant: 'secondary', onClick: open }
  }
  if (status === 'unscheduled') {
    return { label: 'View Details', variant: 'secondary', onClick: open }
  }
  if (status === 'passed' || status === 'failed') {
    return { label: 'View Report', variant: 'secondary', onClick: open }
  }
  if (status === 'missed' || status === 'not_ready' || status === 'rescheduled') {
    return { label: 'Propose New Date', variant: 'secondary', onClick: open }
  }
  if (status === 'on_hold') {
    return { label: 'View Details', variant: 'secondary', onClick: open }
  }
  return null
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: ScheduleTab }) {
  const messages: Record<ScheduleTab, { title: string; sub: string }> = {
    today:                { title: 'No inspections today',         sub: 'Enjoy the breather, or check upcoming.' },
    upcoming:             { title: 'No upcoming inspections',      sub: 'New assignments will appear here.' },
    pending_confirmation: { title: 'All caught up',                sub: 'No dates waiting on your confirmation.' },
    unscheduled:          { title: 'Nothing unscheduled',          sub: 'QA Manager has dated everything assigned to you.' },
    completed:            { title: 'No completed inspections yet', sub: 'Reports you submit will show up here.' },
    missed:               { title: 'No missed inspections',        sub: 'Good — your visit adherence is on track.' },
  }
  const m = messages[tab]
  return (
    <div style={{
      textAlign:   'center',
      padding:     '60px 30px',
      color:       'var(--ds-text-secondary)',
    }}>
      <div style={{
        width:        56,
        height:       56,
        borderRadius: 28,
        background:   'var(--ds-bg-subtle)',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        margin:       '0 auto 14px',
        color:        'var(--ds-text-tertiary)',
      }}>
        <CalendarCheck size={24} strokeWidth={2} />
      </div>
      <div style={{ fontWeight: 600, color: 'var(--ds-text)', fontSize: 15 }}>{m.title}</div>
      <div style={{ fontSize: 12.5, marginTop: 4 }}>{m.sub}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Sheet — drives Confirm Date / Flag Conflict / Propose New Date flows
// ─────────────────────────────────────────────────────────────────────────────

type SheetMode = 'menu' | 'flag-conflict' | 'propose' | 'submitting' | 'success'

function ActionSheet({
  request, onClose, onConfirmed,
}: {
  request: InspectionRequest
  onClose: () => void
  onConfirmed: (requestId: string) => void
}) {
  // Determine which flow to start in
  const isReschedule = request.status === 'missed'
                    || request.status === 'not_ready'
                    || request.status === 'rescheduled'

  const initialMode: SheetMode = isReschedule ? 'propose' : 'menu'
  const [mode, setMode] = useState<SheetMode>(initialMode)
  const [reason, setReason] = useState('')
  const [proposedDate, setProposedDate] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const submitConfirm = () => {
    setMode('submitting')
    setSuccessMessage('Date confirmed — vendor and QA Manager notified')
    setTimeout(() => {
      setMode('success')
      setTimeout(() => onConfirmed(request.id), 1100)
    }, 700)
  }

  const submitFlagConflict = () => {
    if (reason.trim().length < 8) return
    setMode('submitting')
    setSuccessMessage('Conflict flagged — QA Manager will re-assign')
    setTimeout(() => {
      setMode('success')
      setTimeout(() => onConfirmed(request.id), 1100)
    }, 700)
  }

  const submitPropose = () => {
    if (!proposedDate || reason.trim().length < 8) return
    setMode('submitting')
    setSuccessMessage(`New date ${formatScheduledDate(proposedDate)} proposed — awaiting QA Manager approval`)
    setTimeout(() => {
      setMode('success')
      setTimeout(() => onConfirmed(request.id), 1100)
    }, 700)
  }

  const title = mode === 'flag-conflict' ? 'Flag Date Conflict'
              : mode === 'propose'       ? 'Propose New Date'
              : mode === 'submitting'    ? 'Submitting…'
              : mode === 'success'       ? 'Done'
              : 'Confirm Schedule'

  return (
    <Overlay onClose={mode === 'submitting' ? () => {} : onClose}>
      <BottomSheet onClose={onClose} title={title}>
        {/* Context strip — always visible */}
        <div style={{
          padding: '4px 16px 12px',
        }}>
          <div style={{
            background: 'var(--ds-bg-subtle)',
            border: '1px solid var(--ds-border)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 5,
            fontSize: 12,
            color: 'var(--ds-text-secondary)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--ds-text)', fontSize: 13 }}>{request.styleName}</span>
              <span style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10.5,
                color: 'var(--ds-text-tertiary)',
              }}>{request.reportNumber}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={11} strokeWidth={2} />
              {request.vendorName} · {request.vendorCity}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={11} strokeWidth={2} />
              {formatScheduledDate(request.scheduledDate || request.readyDate)}
              {request.timeWindow && <span>· {request.timeWindow}</span>}
            </div>
          </div>
        </div>

        {/* Body — varies by mode */}
        {mode === 'menu' && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={submitConfirm} style={primaryBtn}>
              <Check size={16} strokeWidth={2.4} />
              Confirm this date
            </button>
            <button type="button" onClick={() => setMode('flag-conflict')} style={secondaryBtn}>
              <AlertTriangle size={15} strokeWidth={2} />
              Flag a conflict
            </button>
            <div style={{
              fontSize: 11, color: 'var(--ds-text-tertiary)',
              textAlign: 'center', marginTop: 4, lineHeight: 1.4,
            }}>
              Confirming notifies the vendor with your name and the agreed time window. Flagging asks the QA Manager to re-assign.
            </div>
          </div>
        )}

        {mode === 'flag-conflict' && (
          <div style={{ padding: '0 16px 16px' }}>
            <SheetField label="Reason (required, min 8 chars)">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Already inspecting at another vendor in Faridabad that day"
                rows={3}
                style={textareaStyle}
              />
            </SheetField>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setMode('menu')} style={secondaryBtn}>
                Back
              </button>
              <button type="button" onClick={submitFlagConflict}
                disabled={reason.trim().length < 8}
                style={{ ...primaryBtn, opacity: reason.trim().length < 8 ? 0.5 : 1, cursor: reason.trim().length < 8 ? 'not-allowed' : 'pointer' }}>
                <Send size={14} strokeWidth={2.2} />
                Send to QA Manager
              </button>
            </div>
          </div>
        )}

        {mode === 'propose' && (
          <div style={{ padding: '0 16px 16px' }}>
            <SheetField label="Original scheduled date">
              <div style={{
                padding: '10px 12px',
                background: 'var(--ds-bg-subtle)',
                border: '1px solid var(--ds-border)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--ds-text-tertiary)',
                textDecoration: 'line-through',
              }}>
                {formatScheduledDate(request.scheduledDate || request.readyDate)}
              </div>
            </SheetField>
            <SheetField label="Propose new date">
              <input
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--ds-border)', borderRadius: 8,
                  background: 'var(--ds-surface)',
                  fontSize: 13.5, color: 'var(--ds-text)',
                  fontFamily: 'inherit',
                }}
              />
            </SheetField>
            <SheetField label="Reason (required, min 8 chars)">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  request.status === 'not_ready'
                    ? 'e.g. Vendor confirms goods will be packed and ready by this date'
                    : 'e.g. Missed previous date due to factory closure — vendor confirms readiness'
                }
                rows={3}
                style={textareaStyle}
              />
            </SheetField>
            <div style={{
              fontSize: 11, color: 'var(--ds-info)',
              background: 'var(--ds-info-bg)',
              border: '1px solid var(--ds-info-border)',
              borderRadius: 8, padding: '8px 10px',
              marginBottom: 12, lineHeight: 1.4,
            }}>
              QA Manager must approve before the new date becomes effective. Vendor will be notified once approved.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} style={secondaryBtn}>
                Cancel
              </button>
              <button type="button" onClick={submitPropose}
                disabled={!proposedDate || reason.trim().length < 8}
                style={{
                  ...primaryBtn,
                  opacity: (!proposedDate || reason.trim().length < 8) ? 0.5 : 1,
                  cursor: (!proposedDate || reason.trim().length < 8) ? 'not-allowed' : 'pointer',
                }}>
                <Send size={14} strokeWidth={2.2} />
                Send for approval
              </button>
            </div>
          </div>
        )}

        {mode === 'submitting' && (
          <div style={{ padding: '0 16px 28px', textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 22,
              border: '3px solid var(--ds-primary-light)',
              borderTopColor: 'var(--ds-primary)',
              animation: 'ds-spin 0.7s linear infinite',
              margin: '20px auto 14px',
            }} />
            <div style={{ fontSize: 13, color: 'var(--ds-text-secondary)' }}>Submitting…</div>
          </div>
        )}

        {mode === 'success' && (
          <div style={{ padding: '0 16px 28px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28,
              background: 'var(--ds-success-bg)',
              color: 'var(--ds-success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '12px auto 14px',
            }}>
              <CheckCircle2 size={28} strokeWidth={2.4} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ds-text)', marginBottom: 4 }}>
              {successMessage}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ds-text-tertiary)' }}>
              Closing…
            </div>
          </div>
        )}
      </BottomSheet>
    </Overlay>
  )
}

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: '12px 14px',
  border: 'none',
  background: 'var(--ds-primary)',
  color: '#fff',
  borderRadius: 10,
  fontSize: 14, fontWeight: 600,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  boxShadow: '0 1px 3px rgba(204,120,92,0.35)',
}

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  padding: '12px 14px',
  border: '1px solid var(--ds-border)',
  background: 'var(--ds-surface)',
  color: 'var(--ds-text-secondary)',
  borderRadius: 10,
  fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--ds-border)',
  borderRadius: 8,
  background: 'var(--ds-surface)',
  fontSize: 13, color: 'var(--ds-text)',
  fontFamily: 'inherit', resize: 'none',
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'var(--ds-text-secondary)', marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Overlay + Bottom-sheet primitives (duplicated from InspectionFormClient
// for self-containment; can be hoisted to a shared file later) ───────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(28,25,23,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'ds-overlay-fade 0.15s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480 }}>
        {children}
      </div>
    </div>
  )
}

function BottomSheet({ children, onClose, title }: {
  children: React.ReactNode; onClose: () => void; title: string
}) {
  return (
    <div style={{
      background: 'var(--ds-surface)',
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      maxHeight: '92vh', overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      animation: 'ds-slide-up 0.2s ease-out',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 2,
        background: 'var(--ds-surface)',
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--ds-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--ds-border)' }} />
        </div>
        <h3 style={{
          margin: 0, fontSize: 15, fontWeight: 600,
          color: 'var(--ds-text)', letterSpacing: '-0.01em',
        }}>{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close"
          style={{
            width: 30, height: 30, borderRadius: 8,
            border: 'none', background: 'var(--ds-bg-subtle)',
            color: 'var(--ds-text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>
      {children}
    </div>
  )
}
