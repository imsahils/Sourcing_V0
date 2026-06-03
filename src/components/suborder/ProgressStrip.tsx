'use client'
import { cn } from '@/lib/utils'
import { Check, Zap } from 'lucide-react'
import type { SpineStage } from '@/lib/types'

const stages: { key: SpineStage; label: string; short: string }[] = [
  { key: 'order-brief', label: 'Order Brief', short: 'Brief' },
  { key: 'assigned',    label: 'Assigned',    short: 'Assigned' },
  { key: 'vendor',      label: 'Vendor',      short: 'Vendor' },
  { key: 'costing',     label: 'Costing',     short: 'Costing' },
  { key: 'pre-prod',    label: 'Pre-Production', short: 'Pre-Prod' },
  { key: 'production',  label: 'Production',  short: 'Production' },
  { key: 'fi',          label: 'Inspection',  short: 'FI' },
  { key: 'asn',         label: 'ASN',         short: 'ASN' },
  { key: 'grn',         label: 'GRN',         short: 'GRN' },
]

const stageOrder = stages.map(s => s.key)

export function ProgressStrip({
  currentStage,
  preProdUnlocked,
}: {
  currentStage: SpineStage
  preProdUnlocked?: boolean
}) {
  const currentIdx = stageOrder.indexOf(currentStage)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
      <div className="flex items-center overflow-x-auto no-scrollbar pb-1">
        {stages.map((stage, i) => {
          const isDone    = i < currentIdx
          const isActive  = i === currentIdx
          const isPending = i > currentIdx

          // Pre-prod node: amber when unlocked early (costing is current stage, pre-prod is next)
          const isPreProd      = stage.key === 'pre-prod'
          const isUnlockedEarly = isPreProd && preProdUnlocked && isPending

          return (
            <div key={stage.key} className="flex items-center flex-shrink-0">
              {/* Stage node */}
              <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  isDone          && 'bg-green-500 text-white',
                  isActive        && 'bg-violet-600 text-white ring-4 ring-violet-100',
                  isUnlockedEarly && 'bg-amber-400 text-white ring-4 ring-amber-100',
                  isPending && !isUnlockedEarly && 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                )}>
                  {isDone
                    ? <Check className="w-4 h-4" strokeWidth={3} />
                    : isUnlockedEarly
                      ? <Zap className="w-3.5 h-3.5" />
                      : <span>{i + 1}</span>
                  }
                </div>
                <span className={cn(
                  'text-xs text-center leading-tight',
                  isDone          && 'text-green-600 font-medium',
                  isActive        && 'text-violet-700 font-semibold',
                  isUnlockedEarly && 'text-amber-600 font-semibold',
                  isPending && !isUnlockedEarly && 'text-slate-400'
                )}>
                  {stage.short}
                </span>
              </div>

              {/* Connector */}
              {i < stages.length - 1 && (
                <div className={cn(
                  'h-0.5 w-8 flex-shrink-0 mx-1 mb-5',
                  i < currentIdx ? 'bg-green-400' : 'bg-slate-200'
                )} />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-500 mt-2">
        Current stage:{' '}
        <strong className="text-violet-700">
          {stages.find(s => s.key === currentStage)?.label}
        </strong>
        {' '}· {currentIdx + 1} of {stages.length} complete
        {preProdUnlocked && currentStage !== 'pre-prod' && currentIdx < stageOrder.indexOf('pre-prod') && (
          <span className="ml-2 text-amber-600 font-medium">⚡ Pre-prod unlocked</span>
        )}
      </p>
    </div>
  )
}
