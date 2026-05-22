'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Camera, Package, ClipboardList, Ruler,
  CalculatorIcon, FlaskConical, PenLine, Check, Save, AlertCircle,
  Plus, ChevronRight, Building2, X, Trash2, MessageCircleQuestion,
  CheckCircle2, XCircle, AlertTriangle, ImagePlus, Send, Loader2, Image as ImageIcon,
} from 'lucide-react'
import { getInspectionById, type InspectionRequest } from '@/lib/inspection-mock'
import { computeAQL, evaluateAQL, isBorderline, type AQLLevel, type AQLPlan } from '@/lib/aql'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Defect {
  id:          string
  description: string
  severity:    'major' | 'minor'
  count:       number
  photos:      string[]                // placeholder URLs in mock
}

export interface ConsultationResponse {
  recommendation: 'pass' | 'hold' | 'fail'
  note:           string
  respondedAt:    string
  respondedBy:    string
}

export interface Consultation {
  requestedAt:    string
  inspectorNote:  string
  status:         'pending' | 'answered'
  response?:      ConsultationResponse
}

export type ResultValue = 'pass' | 'hold' | 'fail'

export interface InspectorOverride {
  result: ResultValue
  reason: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Section definitions
// ─────────────────────────────────────────────────────────────────────────────

type SectionKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

const SECTIONS: { key: SectionKey; title: string; icon: any }[] = [
  { key: 'A', title: 'Order & Packing',    icon: Package        },
  { key: 'B', title: 'Workmanship',        icon: ClipboardList  },
  { key: 'C', title: 'Measurements',       icon: Ruler          },
  { key: 'D', title: 'AQL Evaluation',     icon: CalculatorIcon },
  { key: 'E', title: 'Test Results',       icon: FlaskConical   },
  { key: 'F', title: 'Remarks & Sign-off', icon: PenLine        },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function InspectionFormClient({ id }: { id: string }) {
  const router = useRouter()
  const request = useMemo(() => getInspectionById(id), [id])
  const [activeSection, setActiveSection] = useState<SectionKey>('A')

  // Form state — shared across sections B and D
  const [ppSamplePhoto, setPPSamplePhoto] = useState<string | null>(null)
  const [defects, setDefects] = useState<Defect[]>([])
  const [aqlMajor] = useState<AQLLevel>(2.5)   // Bewakoof default
  const [aqlMinor] = useState<AQLLevel>(4.0)   // Bewakoof default
  const [override, setOverride] = useState<InspectorOverride | null>(null)
  const [consultation, setConsultation] = useState<Consultation | null>(null)

  // Overlay states
  const [defectSheetOpen, setDefectSheetOpen] = useState(false)
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null)
  const [consultationOpen, setConsultationOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)

  if (!request) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ds-text-secondary)' }}>
        <AlertCircle size={32} style={{ margin: '0 auto 12px', color: 'var(--ds-danger)' }} />
        <div style={{ fontWeight: 600, color: 'var(--ds-text)' }}>Inspection not found</div>
        <button
          onClick={() => router.push('/inspector')}
          style={{
            marginTop: 16, padding: '9px 16px',
            background: 'var(--ds-primary)', color: '#fff',
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Back to schedule
        </button>
      </div>
    )
  }

  // ─── Defect handlers ──────────────────────────────────────────────────────
  const onSaveDefect = (defect: Defect) => {
    setDefects(prev => {
      const existing = prev.findIndex(d => d.id === defect.id)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = defect
        return next
      }
      return [...prev, defect]
    })
    setDefectSheetOpen(false)
    setEditingDefect(null)
  }
  const onDeleteDefect = (id: string) => {
    setDefects(prev => prev.filter(d => d.id !== id))
  }

  // ─── Consultation handlers ────────────────────────────────────────────────
  const onRequestConsultation = (note: string) => {
    const requestedAt = new Date().toISOString()
    setConsultation({
      requestedAt,
      inspectorNote: note,
      status: 'pending',
    })
    // Simulated QA Manager response after 2.5s
    setTimeout(() => {
      setConsultation(prev => prev ? {
        ...prev,
        status: 'answered',
        response: {
          recommendation: 'pass',
          note: 'Approve as Pass — minor defects acceptable for this customer segment. Note in remarks.',
          respondedAt:  new Date().toISOString(),
          respondedBy:  'Kathiresan (QA Manager)',
        },
      } : null)
    }, 2500)
  }

  return (
    <>
      <SubHeader request={request} onBack={() => router.push('/inspector')} />
      <SectionStepper active={activeSection} onChange={setActiveSection} defectCount={defects.length} hasConsultation={!!consultation} />

      <div style={{
        flex: 1, padding: '16px 16px 100px', background: 'var(--ds-bg)',
      }}>
        {activeSection === 'A' && (
          <SectionA request={request} />
        )}
        {activeSection === 'B' && (
          <SectionB
            ppSamplePhoto={ppSamplePhoto}
            onCapturePPSample={() => setPPSamplePhoto(mockPhotoUrl('pp-sample'))}
            defects={defects}
            onAddDefect={() => { setEditingDefect(null); setDefectSheetOpen(true) }}
            onEditDefect={(d) => { setEditingDefect(d); setDefectSheetOpen(true) }}
            onDeleteDefect={onDeleteDefect}
          />
        )}
        {activeSection === 'C' && (
          <SectionStub title="Section C — Measurement Verification" body="Per-POM table or photo upload of physical measurement sheet." />
        )}
        {activeSection === 'D' && (
          <SectionD
            request={request}
            defects={defects}
            aqlMajor={aqlMajor}
            aqlMinor={aqlMinor}
            consultation={consultation}
            override={override}
            onRequestConsultation={() => setConsultationOpen(true)}
            onOverride={() => setOverrideOpen(true)}
            onClearOverride={() => setOverride(null)}
          />
        )}
        {activeSection === 'E' && (
          <SectionStub title="Section E — Test Results" body="Acceptance checklist: Accessories / Quality / Measurements / GPT / Labelling / Quantity. GPT supports Pass / Fail / Pending / Waived states." />
        )}
        {activeSection === 'F' && (
          <SectionStub title="Section F — Remarks & Sign-off" body="Inspector remarks, overall result (Pass / Hold / Fail / Not Ready), factory rep name + signature photo, inspector digital sign-off." />
        )}
      </div>

      <BottomBar
        activeSection={activeSection}
        onAdvance={() => {
          const idx = SECTIONS.findIndex(s => s.key === activeSection)
          if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].key)
        }}
      />

      {/* Overlays */}
      {defectSheetOpen && (
        <DefectSheet
          initial={editingDefect}
          onClose={() => { setDefectSheetOpen(false); setEditingDefect(null) }}
          onSave={onSaveDefect}
        />
      )}
      {consultationOpen && (
        <ConsultationDialog
          request={request}
          defects={defects}
          aqlMajor={aqlMajor}
          aqlMinor={aqlMinor}
          consultation={consultation}
          onClose={() => setConsultationOpen(false)}
          onSubmit={onRequestConsultation}
        />
      )}
      {overrideOpen && (
        <OverrideDialog
          currentOverride={override}
          onClose={() => setOverrideOpen(false)}
          onSave={(o) => { setOverride(o); setOverrideOpen(false) }}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-header
// ─────────────────────────────────────────────────────────────────────────────

function SubHeader({ request, onBack }: { request: InspectionRequest; onBack: () => void }) {
  return (
    <div style={{
      position: 'sticky', top: 62, zIndex: 6,
      background: 'var(--ds-surface)',
      borderBottom: '1px solid var(--ds-border)',
      padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onBack} aria-label="Back"
          style={{
            width: 34, height: 34, borderRadius: 9,
            border: '1px solid var(--ds-border)', background: 'var(--ds-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ds-text-secondary)', cursor: 'pointer', flexShrink: 0,
          }}>
          <ArrowLeft size={16} strokeWidth={2.2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--ds-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{request.styleName}</div>
          <div style={{
            fontSize: 10.5, color: 'var(--ds-text-tertiary)',
            fontFamily: 'ui-monospace, monospace', marginTop: 1,
          }}>{request.reportNumber}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', borderRadius: 999,
          background: 'var(--ds-success-bg)', color: 'var(--ds-success)',
          border: '1px solid var(--ds-success-border)',
          fontSize: 10.5, fontWeight: 600,
        }}>
          <Save size={10} strokeWidth={2.4} />
          Auto-saved
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section stepper
// ─────────────────────────────────────────────────────────────────────────────

function SectionStepper({
  active, onChange, defectCount, hasConsultation,
}: {
  active: SectionKey
  onChange: (k: SectionKey) => void
  defectCount: number
  hasConsultation: boolean
}) {
  return (
    <div style={{
      position: 'sticky', top: 118, zIndex: 5,
      background: 'var(--ds-bg)', borderBottom: '1px solid var(--ds-border)',
      padding: '8px 12px', overflowX: 'auto',
      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
        {SECTIONS.map(s => {
          const isActive = s.key === active
          const Icon = s.icon
          const showBadge =
            (s.key === 'B' && defectCount > 0) ||
            (s.key === 'D' && hasConsultation)
          return (
            <button key={s.key} type="button" onClick={() => onChange(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 11px', borderRadius: 8,
                border: isActive ? '1px solid var(--ds-primary)' : '1px solid var(--ds-border)',
                background: isActive ? 'var(--ds-primary-light)' : 'var(--ds-surface)',
                color: isActive ? 'var(--ds-primary-dark)' : 'var(--ds-text-secondary)',
                fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                position: 'relative',
              }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                background: isActive ? 'var(--ds-primary)' : 'var(--ds-bg-subtle)',
                color: isActive ? '#fff' : 'var(--ds-text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
              }}>{s.key}</span>
              <Icon size={13} strokeWidth={2} />
              <span>{s.title.split(' — ')[0]}</span>
              {showBadge && (
                <span style={{
                  marginLeft: 2,
                  minWidth: 16,
                  padding: '0 5px',
                  height: 16,
                  borderRadius: 8,
                  background: 'var(--ds-primary)',
                  color: '#fff',
                  fontSize: 9.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {s.key === 'B' ? defectCount : '!'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section A — Order & Packing Verification
// ─────────────────────────────────────────────────────────────────────────────

function SectionA({ request }: { request: InspectionRequest }) {
  return (
    <>
      <div style={{
        background: 'var(--ds-warning-bg)', border: '1px solid var(--ds-warning-border)',
        borderRadius: 10, padding: '10px 12px', marginBottom: 14,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <AlertCircle size={15} strokeWidth={2.2} style={{ color: 'var(--ds-warning)', marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: 'var(--ds-warning)', lineHeight: 1.4 }}>
          <strong>Capture all three photo sets before any cartons are moved or opened.</strong> Carton stacking must be the first action — it&apos;s evidence the goods were in original packed state.
        </div>
      </div>

      <SubsectionTitle>Mandatory captures</SubsectionTitle>
      <CaptureCard order="1" title="Carton Stacking"      description="Photos of cartons as stacked, before anything is moved" required count={0} />
      <CaptureCard order="2" title="Packing List per destination" description="One photo per warehouse" required count={0} />
      <CaptureCard order="3" title="Packed Goods (cartons opened)" description="Goods condition after cartons opened" required count={0} />

      <SubsectionTitle style={{ marginTop: 22 }}>Order information</SubsectionTitle>
      <InfoBlock>
        <FieldRow label="Fabricate Code" value={request.fabricateCode} mono />
        <FieldRow label="Style Code"     value={request.styleCode} mono />
        <FieldRow label="Style Name"     value={request.styleName} />
        <FieldRow label="PO Number"      value={request.poNumber} mono />
        <FieldRow label="Sourcing POC"   value={request.sourcingPocName} />
        <FieldRow label="Merchandise"    value={request.merchandiseCategory} />
      </InfoBlock>

      <SubsectionTitle style={{ marginTop: 22 }}>Vendor</SubsectionTitle>
      <InfoBlock>
        <FieldRow icon={Building2} label="Vendor"  value={request.vendorName} />
        <FieldRow                  label="Premise" value={request.vendorPremise} />
        <FieldRow                  label="City"    value={request.vendorCity} />
      </InfoBlock>

      <SubsectionTitle style={{ marginTop: 22 }}>Quantities to verify</SubsectionTitle>
      <InfoBlock>
        <FieldRow label="PO Qty (total)"            value={`${request.poQty.toLocaleString('en-IN')} pcs`} />
        <FieldRow label="Vendor declared packed"    value={`${request.packedQtyAtRequest.toLocaleString('en-IN')} pcs`} />
        <FieldRow label="Inspection requested"      value={`${request.inspectionRequestedQtyTotal.toLocaleString('en-IN')} pcs (${request.colours.length} colour${request.colours.length > 1 ? 's' : ''})`} />
      </InfoBlock>

      <SubsectionTitle style={{ marginTop: 22 }}>Per-colour confirmation</SubsectionTitle>
      <div style={{
        background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {request.inspectionRequestedQtyPerColor.map((c, idx) => (
          <div key={c.colour} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px',
            borderTop: idx === 0 ? 'none' : '1px solid var(--ds-border)',
            fontSize: 13,
          }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ds-text)' }}>{c.colour}</div>
              <div style={{ fontSize: 11, color: 'var(--ds-text-tertiary)', marginTop: 1 }}>
                Declared {c.qty.toLocaleString('en-IN')} pcs
              </div>
            </div>
            <input type="number" placeholder="Confirm" style={{
              width: 88, padding: '6px 10px',
              border: '1px solid var(--ds-border)', borderRadius: 6,
              fontSize: 13, fontWeight: 500,
              color: 'var(--ds-text)', textAlign: 'right',
              background: 'var(--ds-bg)',
            }} />
          </div>
        ))}
      </div>

      <SubsectionTitle style={{ marginTop: 22 }}>Cartons</SubsectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <InputBlock label="Total cartons present" placeholder="e.g. 12" type="number" />
        <InputBlock label="Cartons selected for AQL" placeholder="e.g. 3" type="number" />
      </div>
      <div style={{ marginTop: 12 }}>
        <InputBlock label="Carton numbers selected" placeholder="e.g. C-04, C-07, C-11" />
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section B — Workmanship
// ─────────────────────────────────────────────────────────────────────────────

function SectionB({
  ppSamplePhoto,
  onCapturePPSample,
  defects,
  onAddDefect,
  onEditDefect,
  onDeleteDefect,
}: {
  ppSamplePhoto: string | null
  onCapturePPSample: () => void
  defects: Defect[]
  onAddDefect: () => void
  onEditDefect: (d: Defect) => void
  onDeleteDefect: (id: string) => void
}) {
  const totals = useMemo(() => {
    let major = 0, minor = 0
    for (const d of defects) {
      if (d.severity === 'major') major += d.count
      else minor += d.count
    }
    return { major, minor }
  }, [defects])

  return (
    <>
      {/* PP Sample — mandatory first */}
      <SubsectionTitle>Reference sample</SubsectionTitle>
      <button
        type="button"
        onClick={onCapturePPSample}
        style={{
          width: '100%',
          background: 'var(--ds-surface)',
          border: ppSamplePhoto
            ? '1px solid var(--ds-success-border)'
            : '1px solid var(--ds-border)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 10,
          background: ppSamplePhoto ? 'var(--ds-success-bg)' : 'var(--ds-primary-light)',
          color: ppSamplePhoto ? 'var(--ds-success)' : 'var(--ds-primary-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, position: 'relative', overflow: 'hidden',
        }}>
          {ppSamplePhoto ? (
            <PhotoThumb url={ppSamplePhoto} />
          ) : (
            <Camera size={20} strokeWidth={2} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: 'var(--ds-text-tertiary)',
              background: 'var(--ds-bg-subtle)', padding: '1px 6px', borderRadius: 4,
            }}>STEP 1</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: ppSamplePhoto ? 'var(--ds-success)' : 'var(--ds-danger)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{ppSamplePhoto ? 'Captured' : 'Required'}</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ds-text)', marginTop: 2 }}>
            PP Sample Photo
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ds-text-secondary)', marginTop: 1 }}>
            Reference garment defects are judged against
          </div>
        </div>
        <div style={{ color: 'var(--ds-text-tertiary)', flexShrink: 0 }}>
          {ppSamplePhoto ? <Check size={16} strokeWidth={2.4} style={{ color: 'var(--ds-success)' }} /> : <Plus size={16} strokeWidth={2.2} />}
        </div>
      </button>

      {/* Defect counter banner */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 14,
      }}>
        <DefectTotalCard label="Major" value={totals.major} color="danger" />
        <DefectTotalCard label="Minor" value={totals.minor} color="warning" />
        <DefectTotalCard label="Total" value={defects.length} color="neutral" sub="entries" />
      </div>

      {/* Defect list */}
      <SubsectionTitle>Defects found</SubsectionTitle>
      {defects.length === 0 ? (
        <div style={{
          background: 'var(--ds-surface)', border: '1px dashed var(--ds-border)',
          borderRadius: 12, padding: '24px 18px', textAlign: 'center',
          marginBottom: 12,
        }}>
          <ClipboardList size={20} style={{ color: 'var(--ds-text-tertiary)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ds-text)' }}>No defects logged yet</div>
          <div style={{ fontSize: 12, color: 'var(--ds-text-secondary)', marginTop: 4 }}>
            Add defects as you find them — no limit
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {defects.map(d => (
            <DefectRow key={d.id} defect={d} onEdit={() => onEditDefect(d)} onDelete={() => onDeleteDefect(d.id)} />
          ))}
        </div>
      )}

      {/* Add defect button */}
      <button
        type="button"
        onClick={onAddDefect}
        disabled={!ppSamplePhoto}
        style={{
          width: '100%',
          padding: '12px 14px',
          border: '1px solid var(--ds-primary)',
          background: ppSamplePhoto ? 'var(--ds-primary-light)' : 'var(--ds-bg-subtle)',
          color: ppSamplePhoto ? 'var(--ds-primary-dark)' : 'var(--ds-text-tertiary)',
          borderRadius: 10,
          fontSize: 14, fontWeight: 600,
          cursor: ppSamplePhoto ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: ppSamplePhoto ? 1 : 0.6,
        }}
      >
        <Plus size={16} strokeWidth={2.4} />
        Add Defect
      </button>
      {!ppSamplePhoto && (
        <div style={{
          marginTop: 8, fontSize: 11.5, color: 'var(--ds-text-tertiary)',
          textAlign: 'center', fontStyle: 'italic',
        }}>
          Capture PP Sample photo first
        </div>
      )}

      <div style={{
        marginTop: 16,
        padding: '10px 12px',
        background: 'var(--ds-info-bg)',
        border: '1px solid var(--ds-info-border)',
        borderRadius: 8,
        fontSize: 11.5,
        color: 'var(--ds-info)',
        lineHeight: 1.45,
      }}>
        <strong>No cap on defects or photos.</strong> Replaces the AppSheet 8-defect limit. Photos are mandatory for Major defects, optional but recommended for Minor.
      </div>

      <div style={{ height: 24 }} />
    </>
  )
}

function DefectTotalCard({ label, value, color, sub }: {
  label: string
  value: number
  color: 'danger' | 'warning' | 'neutral'
  sub?: string
}) {
  const colors = {
    danger:  { bg: 'var(--ds-danger-bg)',  fg: 'var(--ds-danger)',  br: 'var(--ds-danger-border)' },
    warning: { bg: 'var(--ds-warning-bg)', fg: 'var(--ds-warning)', br: 'var(--ds-warning-border)' },
    neutral: { bg: 'var(--ds-surface)',    fg: 'var(--ds-text)',    br: 'var(--ds-border)' },
  }[color]
  return (
    <div style={{
      flex: 1, padding: '10px 12px',
      background: colors.bg, border: `1px solid ${colors.br}`,
      borderRadius: 10, textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: colors.fg, opacity: 0.8,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: colors.fg,
        letterSpacing: '-0.02em', marginTop: 2,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 10.5, color: colors.fg, opacity: 0.7, marginTop: -2 }}>{sub}</div>
      )}
    </div>
  )
}

function DefectRow({ defect, onEdit, onDelete }: { defect: Defect; onEdit: () => void; onDelete: () => void }) {
  const isMajor = defect.severity === 'major'
  return (
    <div style={{
      background: 'var(--ds-surface)',
      border: '1px solid var(--ds-border)',
      borderLeft: `3px solid ${isMajor ? 'var(--ds-danger)' : 'var(--ds-warning)'}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 4,
              background: isMajor ? 'var(--ds-danger-bg)' : 'var(--ds-warning-bg)',
              color: isMajor ? 'var(--ds-danger)' : 'var(--ds-warning)',
              border: `1px solid ${isMajor ? 'var(--ds-danger-border)' : 'var(--ds-warning-border)'}`,
            }}>{defect.severity}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ds-text-secondary)' }}>
              ×{defect.count}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ds-text-tertiary)' }}>
              · {defect.photos.length} photo{defect.photos.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ds-text)', lineHeight: 1.3 }}>
            {defect.description}
          </div>
          {defect.photos.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              {defect.photos.slice(0, 5).map((p, i) => (
                <div key={i} style={{
                  width: 38, height: 38, borderRadius: 6,
                  background: 'var(--ds-bg-subtle)',
                  border: '1px solid var(--ds-border)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ds-text-tertiary)',
                }}>
                  <PhotoThumb url={p} small />
                </div>
              ))}
              {defect.photos.length > 5 && (
                <div style={{
                  width: 38, height: 38, borderRadius: 6,
                  background: 'var(--ds-bg-subtle)',
                  border: '1px solid var(--ds-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: 'var(--ds-text-secondary)',
                }}>+{defect.photos.length - 5}</div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={onEdit}
            style={{
              width: 30, height: 30, borderRadius: 7,
              border: '1px solid var(--ds-border)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
            <PenLine size={13} strokeWidth={2} />
          </button>
          <button type="button" onClick={onDelete}
            style={{
              width: 30, height: 30, borderRadius: 7,
              border: '1px solid var(--ds-border)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section D — AQL Evaluation
// ─────────────────────────────────────────────────────────────────────────────

function SectionD({
  request, defects, aqlMajor, aqlMinor,
  consultation, override,
  onRequestConsultation, onOverride, onClearOverride,
}: {
  request: InspectionRequest
  defects: Defect[]
  aqlMajor: AQLLevel
  aqlMinor: AQLLevel
  consultation: Consultation | null
  override: InspectorOverride | null
  onRequestConsultation: () => void
  onOverride: () => void
  onClearOverride: () => void
}) {
  // Use packed-at-request as the lot size for AQL.
  // In reality this would be inspector-confirmed packed qty from Section A.
  const plan = useMemo<AQLPlan>(
    () => computeAQL(request.packedQtyAtRequest, aqlMajor, aqlMinor),
    [request.packedQtyAtRequest, aqlMajor, aqlMinor],
  )

  const totals = useMemo(() => {
    let major = 0, minor = 0
    for (const d of defects) {
      if (d.severity === 'major') major += d.count
      else minor += d.count
    }
    return { major, minor }
  }, [defects])

  const systemResult = evaluateAQL(plan, totals.major, totals.minor)
  const borderline = isBorderline(plan, totals.major, totals.minor)
  const finalResult: ResultValue = override?.result ?? systemResult

  return (
    <>
      {/* Plan summary */}
      <SubsectionTitle>AQL plan</SubsectionTitle>
      <InfoBlock>
        <FieldRow label="Lot size (packed qty)" value={`${plan.lotSize.toLocaleString('en-IN')} pcs`} />
        <FieldRow label="Lot band"              value={plan.lotRangeLabel} />
        <FieldRow label="Sample size (code)"    value={`${plan.sampleSize} pcs (${plan.letterCode})`} />
        <FieldRow label="AQL level — Major"     value={`${plan.aqlMajor.toFixed(1)} (max ${plan.maxAllowedMajor})`} />
        <FieldRow label="AQL level — Minor"     value={`${plan.aqlMinor.toFixed(1)} (max ${plan.maxAllowedMinor})`} />
      </InfoBlock>

      {/* Findings vs allowed */}
      <SubsectionTitle style={{ marginTop: 22 }}>Findings vs. allowed</SubsectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FindingsCard
          label="Major defects"
          actual={totals.major}
          max={plan.maxAllowedMajor}
          severity="major"
        />
        <FindingsCard
          label="Minor defects"
          actual={totals.minor}
          max={plan.maxAllowedMinor}
          severity="minor"
        />
      </div>

      {/* System result */}
      <SubsectionTitle style={{ marginTop: 22 }}>System recommendation</SubsectionTitle>
      <ResultCard
        result={systemResult}
        borderline={borderline}
        override={override}
        finalResult={finalResult}
      />

      {/* Consultation panel */}
      <SubsectionTitle style={{ marginTop: 22 }}>QA Manager consultation</SubsectionTitle>
      {consultation ? (
        <ConsultationPanel consultation={consultation} />
      ) : (
        <button
          type="button"
          onClick={onRequestConsultation}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: borderline ? 'var(--ds-primary)' : 'var(--ds-surface)',
            color: borderline ? '#fff' : 'var(--ds-text)',
            border: borderline ? 'none' : '1px solid var(--ds-border)',
            borderRadius: 10,
            fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: borderline ? '0 1px 3px rgba(204,120,92,0.35)' : 'none',
          }}
        >
          <MessageCircleQuestion size={16} strokeWidth={2.2} />
          Request Manager Input
        </button>
      )}
      {borderline && !consultation && (
        <div style={{
          marginTop: 8, fontSize: 11.5,
          color: 'var(--ds-warning)',
          textAlign: 'center', fontStyle: 'italic',
        }}>
          Result is on the borderline — consultation suggested
        </div>
      )}

      {/* Override controls */}
      <div style={{ marginTop: 18 }}>
        {override ? (
          <div style={{
            background: 'var(--ds-warning-bg)',
            border: '1px solid var(--ds-warning-border)',
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertTriangle size={15} style={{ color: 'var(--ds-warning)', marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ds-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Inspector override
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ds-text)', marginTop: 4 }}>
                  System: {systemResult.toUpperCase()} → Override: {override.result.toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ds-text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                  &ldquo;{override.reason}&rdquo;
                </div>
                <button type="button" onClick={onClearOverride}
                  style={{
                    marginTop: 8, fontSize: 11.5, color: 'var(--ds-danger)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: 0, fontWeight: 600,
                  }}>
                  Clear override
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onOverride}
            style={{
              width: '100%',
              padding: '11px 14px',
              border: '1px solid var(--ds-border)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-text-secondary)',
              borderRadius: 10,
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <AlertTriangle size={13} strokeWidth={2} />
            Override system result
          </button>
        )}
      </div>

      <div style={{ height: 24 }} />
    </>
  )
}

function FindingsCard({ label, actual, max, severity }: {
  label: string
  actual: number
  max: number
  severity: 'major' | 'minor'
}) {
  const exceeds = actual > max
  const equals  = actual === max
  const pct = max > 0 ? Math.min(100, (actual / max) * 100) : 0
  const barColor = exceeds
    ? 'var(--ds-danger)'
    : equals
      ? 'var(--ds-warning)'
      : severity === 'major' ? 'var(--ds-primary)' : 'var(--ds-info)'

  return (
    <div style={{
      background: 'var(--ds-surface)',
      border: '1px solid var(--ds-border)',
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'var(--ds-text-tertiary)',
      }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 6,
        marginTop: 4,
      }}>
        <span style={{
          fontSize: 24, fontWeight: 700,
          color: exceeds ? 'var(--ds-danger)' : 'var(--ds-text)',
          letterSpacing: '-0.02em',
        }}>{actual}</span>
        <span style={{ fontSize: 13, color: 'var(--ds-text-tertiary)' }}>
          / {max} allowed
        </span>
      </div>
      <div style={{
        marginTop: 8, height: 4, borderRadius: 2,
        background: 'var(--ds-bg-subtle)',
        overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor }} />
      </div>
      <div style={{
        marginTop: 6, fontSize: 11,
        color: exceeds ? 'var(--ds-danger)' : equals ? 'var(--ds-warning)' : 'var(--ds-success)',
        fontWeight: 600,
      }}>
        {exceeds ? `Exceeds by ${actual - max}` : equals ? 'At limit' : `${max - actual} below limit`}
      </div>
    </div>
  )
}

function ResultCard({ result, borderline, override, finalResult }: {
  result: 'pass' | 'fail'
  borderline: boolean
  override: InspectorOverride | null
  finalResult: ResultValue
}) {
  const display = override ? finalResult : result
  const visuals = {
    pass: { bg: 'var(--ds-success-bg)', fg: 'var(--ds-success)', br: 'var(--ds-success-border)', icon: CheckCircle2, label: 'PASS' },
    fail: { bg: 'var(--ds-danger-bg)',  fg: 'var(--ds-danger)',  br: 'var(--ds-danger-border)',  icon: XCircle,       label: 'FAIL' },
    hold: { bg: 'var(--ds-warning-bg)', fg: 'var(--ds-warning)', br: 'var(--ds-warning-border)', icon: AlertCircle,   label: 'HOLD' },
  }[display]
  const Icon = visuals.icon

  return (
    <div style={{
      background: visuals.bg,
      border: `1px solid ${visuals.br}`,
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 24,
        background: visuals.fg,
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={24} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: visuals.fg, opacity: 0.85,
        }}>
          {override ? 'Final result (overridden)' : 'System AQL result'}
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700,
          color: visuals.fg, letterSpacing: '-0.02em',
          marginTop: 1,
        }}>
          {visuals.label}
        </div>
        {borderline && !override && (
          <div style={{
            fontSize: 11, color: visuals.fg, opacity: 0.85,
            marginTop: 3, fontStyle: 'italic',
          }}>
            Borderline — within 1 defect of limit
          </div>
        )}
      </div>
    </div>
  )
}

function ConsultationPanel({ consultation }: { consultation: Consultation }) {
  const pending = consultation.status === 'pending'
  return (
    <div style={{
      background: 'var(--ds-surface)',
      border: `1px solid ${pending ? 'var(--ds-info-border)' : 'var(--ds-success-border)'}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {pending ? (
          <Loader2 size={16} style={{ color: 'var(--ds-info)', animation: 'ds-spin 1.2s linear infinite' }} />
        ) : (
          <CheckCircle2 size={16} style={{ color: 'var(--ds-success)' }} />
        )}
        <span style={{
          fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: pending ? 'var(--ds-info)' : 'var(--ds-success)',
        }}>
          {pending ? 'Awaiting QA Manager response' : 'QA Manager responded'}
        </span>
      </div>

      <div style={{
        background: 'var(--ds-bg-subtle)', borderRadius: 8,
        padding: '8px 10px', fontSize: 12, color: 'var(--ds-text-secondary)',
        lineHeight: 1.4, marginBottom: 10,
      }}>
        <strong style={{ color: 'var(--ds-text)' }}>You asked:</strong> {consultation.inspectorNote || '(no note)'}
      </div>

      {pending && (
        <div style={{ fontSize: 11.5, color: 'var(--ds-text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
          Typical response time: under 30 minutes. You can keep working — we&apos;ll notify you here.
        </div>
      )}

      {consultation.response && (
        <div style={{
          background: 'var(--ds-success-bg)',
          border: '1px solid var(--ds-success-border)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              color: 'var(--ds-success)',
            }}>Recommends: {consultation.response.recommendation.toUpperCase()}</span>
            <span style={{ fontSize: 10.5, color: 'var(--ds-text-tertiary)' }}>
              {consultation.response.respondedBy}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ds-text)', lineHeight: 1.4 }}>
            {consultation.response.note}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Defect bottom-sheet (Add / Edit)
// ─────────────────────────────────────────────────────────────────────────────

function DefectSheet({ initial, onClose, onSave }: {
  initial: Defect | null
  onClose: () => void
  onSave: (d: Defect) => void
}) {
  const [description, setDescription] = useState(initial?.description ?? '')
  const [severity, setSeverity]       = useState<'major' | 'minor'>(initial?.severity ?? 'minor')
  const [count, setCount]             = useState(initial?.count ?? 1)
  const [photos, setPhotos]           = useState<string[]>(initial?.photos ?? [])

  const isMajor = severity === 'major'
  const needsPhoto = isMajor && photos.length === 0
  const canSave = description.trim().length > 0 && count > 0 && !needsPhoto

  const handleAddPhoto = () => {
    setPhotos(prev => [...prev, mockPhotoUrl(`defect-${prev.length + 1}`)])
  }
  const handleRemovePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <Overlay onClose={onClose}>
      <BottomSheet onClose={onClose} title={initial ? 'Edit Defect' : 'Add Defect'}>
        <div style={{ padding: '4px 16px 16px' }}>
          {/* Description */}
          <SheetField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Stitch joint coming out at side seam"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--ds-border)', borderRadius: 8,
                background: 'var(--ds-surface)',
                fontSize: 13.5, color: 'var(--ds-text)',
                fontFamily: 'inherit', resize: 'none',
              }}
            />
          </SheetField>

          {/* Severity + Count */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
            <SheetField label="Severity">
              <div style={{ display: 'flex', gap: 6 }}>
                <SeverityToggle active={!isMajor} variant="minor" onClick={() => setSeverity('minor')} />
                <SeverityToggle active={isMajor}  variant="major" onClick={() => setSeverity('major')} />
              </div>
            </SheetField>
            <SheetField label="Count">
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button type="button" onClick={() => setCount(c => Math.max(1, c - 1))}
                  style={countBtnStyle}>−</button>
                <input
                  type="number" min={1} value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: 56, padding: '8px 4px',
                    border: '1px solid var(--ds-border)', borderRadius: 6,
                    fontSize: 16, fontWeight: 600,
                    textAlign: 'center', color: 'var(--ds-text)',
                    background: 'var(--ds-surface)',
                  }}
                />
                <button type="button" onClick={() => setCount(c => c + 1)}
                  style={countBtnStyle}>+</button>
              </div>
            </SheetField>
          </div>

          {/* Photos */}
          <SheetField label={`Photos${isMajor ? ' (required for Major)' : ' (recommended)'}`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {photos.map((p, i) => (
                <div key={i} style={{
                  position: 'relative', width: 64, height: 64, borderRadius: 8,
                  background: 'var(--ds-bg-subtle)',
                  border: '1px solid var(--ds-border)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PhotoThumb url={p} />
                  <button type="button" onClick={() => handleRemovePhoto(i)}
                    aria-label="Remove photo"
                    style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 20, height: 20, borderRadius: 10,
                      background: 'rgba(28,25,23,0.7)', color: '#fff',
                      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}>
                    <X size={11} strokeWidth={2.4} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={handleAddPhoto}
                style={{
                  width: 64, height: 64, borderRadius: 8,
                  border: '1.5px dashed var(--ds-border)',
                  background: 'var(--ds-surface)',
                  color: 'var(--ds-text-secondary)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: 2,
                }}>
                <ImagePlus size={16} strokeWidth={2} />
                <span style={{ fontSize: 9.5, fontWeight: 600 }}>Add</span>
              </button>
            </div>
            {needsPhoto && (
              <div style={{ fontSize: 11, color: 'var(--ds-danger)', marginTop: 6, fontStyle: 'italic' }}>
                At least one photo is required for Major defects
              </div>
            )}
          </SheetField>
        </div>

        <div style={{
          borderTop: '1px solid var(--ds-border)',
          padding: '12px 16px',
          background: 'var(--ds-surface)',
          display: 'flex', gap: 8,
          position: 'sticky', bottom: 0,
        }}>
          <button type="button" onClick={onClose}
            style={{
              flex: '0 0 auto', padding: '11px 16px',
              border: '1px solid var(--ds-border)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-text-secondary)',
              borderRadius: 10,
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
            Cancel
          </button>
          <button type="button" disabled={!canSave}
            onClick={() => onSave({
              id: initial?.id ?? `def_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              description: description.trim(),
              severity, count, photos,
            })}
            style={{
              flex: 1, padding: '11px 16px',
              border: 'none',
              background: canSave ? 'var(--ds-primary)' : 'var(--ds-bg-subtle)',
              color: canSave ? '#fff' : 'var(--ds-text-tertiary)',
              borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: canSave ? 'pointer' : 'not-allowed',
              boxShadow: canSave ? '0 1px 3px rgba(204,120,92,0.35)' : 'none',
            }}>
            {initial ? 'Save changes' : 'Add Defect'}
          </button>
        </div>
      </BottomSheet>
    </Overlay>
  )
}

const countBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6,
  border: '1px solid var(--ds-border)',
  background: 'var(--ds-surface)',
  fontSize: 16, fontWeight: 600,
  color: 'var(--ds-text-secondary)',
  cursor: 'pointer',
}

function SeverityToggle({ active, variant, onClick }: {
  active: boolean
  variant: 'major' | 'minor'
  onClick: () => void
}) {
  const isMajor = variant === 'major'
  return (
    <button type="button" onClick={onClick}
      style={{
        flex: 1, padding: '10px 6px',
        border: active
          ? `1.5px solid ${isMajor ? 'var(--ds-danger)' : 'var(--ds-warning)'}`
          : '1px solid var(--ds-border)',
        background: active
          ? (isMajor ? 'var(--ds-danger-bg)' : 'var(--ds-warning-bg)')
          : 'var(--ds-surface)',
        color: active
          ? (isMajor ? 'var(--ds-danger)' : 'var(--ds-warning)')
          : 'var(--ds-text-secondary)',
        borderRadius: 8,
        fontSize: 13, fontWeight: 600,
        textTransform: 'capitalize',
        cursor: 'pointer',
      }}>
      {variant}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Consultation dialog
// ─────────────────────────────────────────────────────────────────────────────

function ConsultationDialog({
  request, defects, aqlMajor, aqlMinor, consultation,
  onClose, onSubmit,
}: {
  request: InspectionRequest
  defects: Defect[]
  aqlMajor: AQLLevel
  aqlMinor: AQLLevel
  consultation: Consultation | null
  onClose: () => void
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const plan = useMemo(
    () => computeAQL(request.packedQtyAtRequest, aqlMajor, aqlMinor),
    [request, aqlMajor, aqlMinor],
  )
  const totals = useMemo(() => {
    let major = 0, minor = 0
    for (const d of defects) {
      if (d.severity === 'major') major += d.count
      else minor += d.count
    }
    return { major, minor }
  }, [defects])

  // If already submitted, show the existing consultation
  if (consultation) {
    return (
      <Overlay onClose={onClose}>
        <BottomSheet onClose={onClose} title="QA Manager Consultation">
          <div style={{ padding: '4px 16px 16px' }}>
            <ConsultationPanel consultation={consultation} />
            <button type="button" onClick={onClose}
              style={{
                width: '100%', marginTop: 16, padding: '11px 16px',
                background: 'var(--ds-primary)', color: '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              Close
            </button>
          </div>
        </BottomSheet>
      </Overlay>
    )
  }

  return (
    <Overlay onClose={onClose}>
      <BottomSheet onClose={onClose} title="Request Manager Input">
        <div style={{ padding: '4px 16px 16px' }}>
          {/* AQL snapshot */}
          <div style={{
            background: 'var(--ds-bg-subtle)',
            border: '1px solid var(--ds-border)',
            borderRadius: 10, padding: 12, marginBottom: 12,
          }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: 'var(--ds-text-tertiary)',
              marginBottom: 8,
            }}>AQL snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
              <SnapshotRow label="Sample size" value={`${plan.sampleSize} pcs`} />
              <SnapshotRow label="Lot size"    value={`${plan.lotSize.toLocaleString('en-IN')} pcs`} />
              <SnapshotRow label="Max Major"   value={`${plan.maxAllowedMajor}`} />
              <SnapshotRow label="Max Minor"   value={`${plan.maxAllowedMinor}`} />
              <SnapshotRow label="Actual Major" value={`${totals.major}`} highlight={totals.major >= plan.maxAllowedMajor} />
              <SnapshotRow label="Actual Minor" value={`${totals.minor}`} highlight={totals.minor >= plan.maxAllowedMinor} />
            </div>
          </div>

          {/* Defect summary */}
          {defects.length > 0 && (
            <div style={{
              background: 'var(--ds-surface)',
              border: '1px solid var(--ds-border)',
              borderRadius: 10, padding: 12, marginBottom: 12,
            }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase', color: 'var(--ds-text-tertiary)',
                marginBottom: 6,
              }}>Defects observed</div>
              {defects.slice(0, 5).map(d => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 0', fontSize: 12,
                }}>
                  <span style={{ color: 'var(--ds-text)', flex: 1, paddingRight: 8 }}>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: 3,
                      background: d.severity === 'major' ? 'var(--ds-danger)' : 'var(--ds-warning)',
                      marginRight: 6, verticalAlign: 'middle',
                    }} />
                    {d.description}
                  </span>
                  <span style={{ color: 'var(--ds-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>×{d.count}</span>
                </div>
              ))}
              {defects.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--ds-text-tertiary)', marginTop: 4 }}>
                  +{defects.length - 5} more
                </div>
              )}
            </div>
          )}

          {/* Inspector note */}
          <SheetField label="Add a note for the manager (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Stitching defects close to the limit but garment quality otherwise good. Customer segment is value-conscious."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--ds-border)', borderRadius: 8,
                background: 'var(--ds-surface)',
                fontSize: 13, color: 'var(--ds-text)',
                fontFamily: 'inherit', resize: 'none',
              }}
            />
          </SheetField>

          <div style={{
            fontSize: 11, color: 'var(--ds-info)',
            background: 'var(--ds-info-bg)',
            border: '1px solid var(--ds-info-border)',
            borderRadius: 8, padding: '8px 10px',
            lineHeight: 1.4,
          }}>
            <strong>Replaces WhatsApp.</strong> Both your request and the QA Manager&apos;s recommendation are logged in the report audit trail. Response SLA: 30 min.
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--ds-border)',
          padding: '12px 16px',
          background: 'var(--ds-surface)',
          display: 'flex', gap: 8,
          position: 'sticky', bottom: 0,
        }}>
          <button type="button" onClick={onClose}
            style={{
              flex: '0 0 auto', padding: '11px 16px',
              border: '1px solid var(--ds-border)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-text-secondary)',
              borderRadius: 10,
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
            Cancel
          </button>
          <button type="button"
            onClick={() => { onSubmit(note.trim()); onClose() }}
            style={{
              flex: 1, padding: '11px 16px',
              border: 'none',
              background: 'var(--ds-primary)', color: '#fff',
              borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 1px 3px rgba(204,120,92,0.35)',
            }}>
            <Send size={14} strokeWidth={2.2} />
            Send to QA Manager
          </button>
        </div>
      </BottomSheet>
    </Overlay>
  )
}

function SnapshotRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--ds-text-tertiary)' }}>{label}</span>
      <span style={{
        fontWeight: 600,
        color: highlight ? 'var(--ds-danger)' : 'var(--ds-text)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Override dialog
// ─────────────────────────────────────────────────────────────────────────────

function OverrideDialog({
  currentOverride, onClose, onSave,
}: {
  currentOverride: InspectorOverride | null
  onClose: () => void
  onSave: (o: InspectorOverride) => void
}) {
  const [result, setResult] = useState<ResultValue>(currentOverride?.result ?? 'hold')
  const [reason, setReason] = useState(currentOverride?.reason ?? '')
  const canSave = reason.trim().length >= 8

  return (
    <Overlay onClose={onClose}>
      <BottomSheet onClose={onClose} title="Override AQL Result">
        <div style={{ padding: '4px 16px 16px' }}>
          <div style={{
            background: 'var(--ds-warning-bg)',
            border: '1px solid var(--ds-warning-border)',
            borderRadius: 10, padding: '10px 12px', marginBottom: 12,
            fontSize: 12, color: 'var(--ds-warning)', lineHeight: 1.4,
          }}>
            <strong>This is a high-attention action.</strong> Overrides are permanently logged. QA Manager and Sourcing POC are notified.
          </div>

          <SheetField label="Override to">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['pass', 'hold', 'fail'] as ResultValue[]).map(r => (
                <button key={r} type="button" onClick={() => setResult(r)}
                  style={{
                    flex: 1, padding: '10px 8px',
                    border: result === r ? '1.5px solid var(--ds-primary)' : '1px solid var(--ds-border)',
                    background: result === r ? 'var(--ds-primary-light)' : 'var(--ds-surface)',
                    color: result === r ? 'var(--ds-primary-dark)' : 'var(--ds-text-secondary)',
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    textTransform: 'capitalize', cursor: 'pointer',
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </SheetField>

          <SheetField label="Reason (required, min 8 chars)">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you overriding the system result?"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--ds-border)', borderRadius: 8,
                background: 'var(--ds-surface)',
                fontSize: 13, color: 'var(--ds-text)',
                fontFamily: 'inherit', resize: 'none',
              }}
            />
          </SheetField>
        </div>

        <div style={{
          borderTop: '1px solid var(--ds-border)',
          padding: '12px 16px',
          background: 'var(--ds-surface)',
          display: 'flex', gap: 8,
          position: 'sticky', bottom: 0,
        }}>
          <button type="button" onClick={onClose}
            style={{
              flex: '0 0 auto', padding: '11px 16px',
              border: '1px solid var(--ds-border)',
              background: 'var(--ds-surface)',
              color: 'var(--ds-text-secondary)',
              borderRadius: 10,
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
            Cancel
          </button>
          <button type="button" disabled={!canSave}
            onClick={() => onSave({ result, reason: reason.trim() })}
            style={{
              flex: 1, padding: '11px 16px',
              border: 'none',
              background: canSave ? 'var(--ds-warning)' : 'var(--ds-bg-subtle)',
              color: canSave ? '#fff' : 'var(--ds-text-tertiary)',
              borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}>
            Save override
          </button>
        </div>
      </BottomSheet>
    </Overlay>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section stub (C, E, F)
// ─────────────────────────────────────────────────────────────────────────────

function SectionStub({ title, body }: { title: string; body: string }) {
  return (
    <div style={{
      background: 'var(--ds-surface)',
      border: '1px dashed var(--ds-border)',
      borderRadius: 12, padding: '30px 22px', textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 24,
        background: 'var(--ds-bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px', color: 'var(--ds-text-tertiary)',
      }}>
        <ClipboardList size={20} strokeWidth={2} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ds-text)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{
        fontSize: 12.5, color: 'var(--ds-text-secondary)',
        lineHeight: 1.5, maxWidth: 320, margin: '0 auto',
      }}>{body}</div>
      <div style={{
        marginTop: 14, padding: '5px 11px',
        background: 'var(--ds-bg-subtle)',
        border: '1px solid var(--ds-border)',
        borderRadius: 999, display: 'inline-block',
        fontSize: 10.5, color: 'var(--ds-text-tertiary)',
        fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        Stub — to build
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom bar
// ─────────────────────────────────────────────────────────────────────────────

function BottomBar({ activeSection, onAdvance }: { activeSection: SectionKey; onAdvance: () => void }) {
  const isLast = activeSection === 'F'
  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 6,
      background: 'var(--ds-surface)', borderTop: '1px solid var(--ds-border)',
      padding: '10px 14px', display: 'flex', gap: 8,
      boxShadow: '0 -2px 8px rgba(28,25,23,0.04)',
    }}>
      <button type="button" style={{
        flex: '0 0 auto', padding: '11px 14px',
        border: '1px solid var(--ds-border)',
        background: 'var(--ds-surface)',
        color: 'var(--ds-text-secondary)',
        borderRadius: 10, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <Save size={14} strokeWidth={2.2} />
        Save draft
      </button>
      <button type="button" onClick={onAdvance}
        style={{
          flex: 1, padding: '11px 14px', border: 'none',
          background: 'var(--ds-primary)', color: '#fff',
          borderRadius: 10, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: '0 1px 3px rgba(204,120,92,0.35)',
        }}>
        {isLast ? (
          <>
            <Check size={15} strokeWidth={2.4} />
            Review & Submit
          </>
        ) : (
          <>
            Next: Section {nextSectionKey(activeSection)}
            <ChevronRight size={15} strokeWidth={2.4} />
          </>
        )}
      </button>
    </div>
  )
}

function nextSectionKey(k: SectionKey): SectionKey {
  const idx = SECTIONS.findIndex(s => s.key === k)
  return SECTIONS[Math.min(idx + 1, SECTIONS.length - 1)].key
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function SubsectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: 'var(--ds-text-tertiary)', margin: '0 0 8px',
      ...style,
    }}>{children}</div>
  )
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--ds-surface)',
      border: '1px solid var(--ds-border)',
      borderRadius: 10, overflow: 'hidden',
    }}>{children}</div>
  )
}

function FieldRow({ icon: Icon, label, value, mono }: {
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string; value: string; mono?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px',
      borderTop: '1px solid var(--ds-border)',
      fontSize: 13, gap: 12,
    }} className="first:border-t-0">
      <div style={{
        color: 'var(--ds-text-secondary)', fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {Icon && <Icon size={12} strokeWidth={2} />}
        {label}
      </div>
      <div style={{
        color: 'var(--ds-text)', fontWeight: 500, textAlign: 'right',
        fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
        fontSize: mono ? 12 : 13,
      }}>{value}</div>
    </div>
  )
}

function InputBlock({ label, placeholder, type = 'text' }: {
  label: string; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'var(--ds-text-secondary)', marginBottom: 5,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</label>
      <input type={type} placeholder={placeholder} style={{
        width: '100%', padding: '9px 12px',
        border: '1px solid var(--ds-border)', borderRadius: 8,
        background: 'var(--ds-surface)',
        fontSize: 13.5, color: 'var(--ds-text)',
      }} />
    </div>
  )
}

function CaptureCard({ order, title, description, required, count }: {
  order: string; title: string; description: string; required?: boolean; count: number
}) {
  return (
    <button type="button" style={{
      width: '100%', background: 'var(--ds-surface)',
      border: '1px solid var(--ds-border)', borderRadius: 10,
      padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: count > 0 ? 'var(--ds-success-bg)' : 'var(--ds-primary-light)',
        color: count > 0 ? 'var(--ds-success)' : 'var(--ds-primary-dark)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {count > 0 ? <Check size={18} strokeWidth={2.4} /> : <Camera size={18} strokeWidth={2} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, color: 'var(--ds-text-tertiary)',
            background: 'var(--ds-bg-subtle)', padding: '1px 6px', borderRadius: 4,
          }}>STEP {order}</span>
          {required && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'var(--ds-danger)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>Required</span>
          )}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ds-text)', marginTop: 2 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ds-text-secondary)', marginTop: 1 }}>{description}</div>
      </div>
      <div style={{ color: 'var(--ds-text-tertiary)', flexShrink: 0 }}>
        {count > 0 ? (
          <span style={{ fontSize: 12, color: 'var(--ds-success)', fontWeight: 600 }}>{count}</span>
        ) : (
          <Plus size={16} strokeWidth={2.2} />
        )}
      </div>
    </button>
  )
}

function PhotoThumb({ url, small }: { url: string; small?: boolean }) {
  // Mock thumbnail — show a stylised photo placeholder
  const id = url.split('/').pop() ?? 'p'
  const hue = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(135deg, hsl(${hue} 35% 60%), hsl(${(hue + 40) % 360} 40% 50%))`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.9)',
    }}>
      <ImageIcon size={small ? 14 : 18} strokeWidth={2} />
    </div>
  )
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'var(--ds-text-secondary)', marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay + BottomSheet primitives
// ─────────────────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(28,25,23,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'ds-overlay-fade 0.15s ease-out',
      }}
    >
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
        {/* Drag handle */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockPhotoUrl(label: string): string {
  return `mock://photo/${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
