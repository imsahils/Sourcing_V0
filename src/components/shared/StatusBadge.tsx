'use client'
import { cn } from '@/lib/utils'
import type { SubOrderStatus, PreProdStageStatus, FIStatus } from '@/lib/types'

// ─── SubOrder Status ──────────────────────────────────────────────────────────

const statusConfig: Record<SubOrderStatus, { label: string; className: string; dot: string }> = {
  'on-track':        { label: 'On Track',        className: 'bg-violet-50 text-violet-700 border border-violet-200',   dot: 'bg-violet-500' },
  'needs-attention': { label: 'Due Today',        className: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  'overdue':         { label: 'Overdue',          className: 'bg-red-50 text-red-700 border border-red-200',      dot: 'bg-red-500' },
  'completed':       { label: 'Completed',        className: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' },
  'not-started':     { label: 'Not Started',      className: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' },
}

export function StatusBadge({ status, className }: { status: SubOrderStatus; className?: string }) {
  const cfg = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', cfg.className, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─── Pre-Production Stage Status ─────────────────────────────────────────────

const ppStageConfig: Record<PreProdStageStatus, { label: string; className: string; icon: string }> = {
  'approved':    { label: 'Approved',    className: 'bg-green-50 text-green-700',  icon: '✓' },
  'pending':     { label: 'Pending',     className: 'bg-amber-50 text-amber-700',  icon: '◌' },
  'overdue':     { label: 'Overdue',     className: 'bg-red-50 text-red-700',      icon: '!' },
  'rejected':    { label: 'Rejected',    className: 'bg-red-50 text-red-700',      icon: '✕' },
  'not-started': { label: 'Not Started', className: 'bg-slate-100 text-slate-500', icon: '–' },
}

export function PreProdStageBadge({ status }: { status: PreProdStageStatus }) {
  const cfg = ppStageConfig[status]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

// ─── FI Status ────────────────────────────────────────────────────────────────

const fiStatusConfig: Record<FIStatus, { label: string; className: string }> = {
  'new':            { label: 'New',               className: 'bg-slate-100 text-slate-600' },
  'not-ready':      { label: 'Not Ready',          className: 'bg-orange-50 text-orange-700' },
  'scheduled':      { label: 'Scheduled',          className: 'bg-violet-50 text-violet-700' },
  'in-progress':    { label: 'In Progress',        className: 'bg-purple-50 text-purple-700' },
  'pass':           { label: 'Pass',               className: 'bg-green-50 text-green-700' },
  'fail':           { label: 'Fail',               className: 'bg-red-50 text-red-700' },
  'hold':           { label: 'Hold',               className: 'bg-amber-50 text-amber-700' },
  're-inspection':  { label: 'Re-inspection',      className: 'bg-orange-50 text-orange-700' },
}

export function FIStatusBadge({ status }: { status: FIStatus }) {
  const cfg = fiStatusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

// ─── Order Type & Tier ────────────────────────────────────────────────────────

export function OrderTypeBadge({ type }: { type: 'NEW' | 'REPLEN' }) {
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide',
      type === 'NEW' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
    )}>
      {type}
    </span>
  )
}

export function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    'HERO':   'bg-yellow-100 text-yellow-800',
    'TIER-1': 'bg-violet-100 text-violet-700',
    'TIER-2': 'bg-slate-100 text-slate-600',
    'TAIL':   'bg-slate-100 text-slate-500',
  }
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', colors[tier] ?? 'bg-slate-100 text-slate-600')}>
      {tier}
    </span>
  )
}
