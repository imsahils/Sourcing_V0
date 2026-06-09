'use client'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FlaskConical, CheckCircle2, X, Clock, AlertTriangle,
  Image as ImageIcon, Upload, Plus, Lock, SlidersHorizontal,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { useCurrentUser } from '@/lib/user-context'
import { subOrders } from '@/lib/data'
import type { SubOrder, PreProdStage, PreProdIteration } from '@/lib/types'

// ─── Tokens & helpers ─────────────────────────────────────────────────────────

const C = {
  bg: '#FAF9F6', surface: '#FFFFFF', text: '#1C1917', sec: '#78716C',
  ter: '#A8A29E', border: '#E7E5E0', subtle: '#F5F4EF',
  primary: '#CC785C', primaryLight: '#FDF0EB', primaryDark: '#B5633E',
  success: '#2E7D52', successBg: '#F0FDF4', successBorder: '#BBF7D0',
  danger: '#B91C1C', dangerBg: '#FEF2F2', dangerBorder: '#FECACA',
  amber: '#92400E', amberBg: '#FFFBEB', amberBorder: '#FDE68A',
  info: '#1D4ED8', infoBg: '#EFF6FF', infoBorder: '#BFDBFE',
}

const TAG_LABELS: Record<string,string> = {
  'shade-too-dark':'Shade too dark','shade-too-light':'Shade too light','contrast-off':'Contrast off',
  'print-misaligned':'Print misaligned','hand-feel':'Hand feel','pattern-repeat-wrong':'Pattern repeat wrong',
  'chest-too-tight':'Chest too tight','chest-too-loose':'Chest too loose','waist-off':'Waist off',
  'length-too-short':'Length too short','length-too-long':'Length too long','sleeve-off':'Sleeve off',
  'construction-issue':'Construction issue','silhouette-wrong':'Silhouette wrong','measurement-out-of-spec':'Measurement out of spec',
  'colour-off':'Colour off','print-placement-wrong':'Print placement wrong','distortion':'Distortion',
  'finishing-poor':'Finishing poor','seam-issue':'Seam issue','delayed':'Delayed',
  'quantity-short':'Quantity short','colorfastness-fail':'Colorfastness fail','shrinkage-out-of-spec':'Shrinkage out of spec','pilling':'Pilling',
}

const REJECTION_TAGS: Record<string, string[]> = {
  'lab-dip':      ['shade-too-dark','shade-too-light','contrast-off','print-misaligned','hand-feel'],
  'strike-off':   ['shade-too-dark','shade-too-light','contrast-off','print-misaligned','pattern-repeat-wrong'],
  'fit-sample':   ['chest-too-tight','chest-too-loose','waist-off','length-too-short','length-too-long','sleeve-off','construction-issue'],
  'fabric-inward':['delayed','quantity-short'],
  'pp-sample':    ['colour-off','print-placement-wrong','distortion','finishing-poor','seam-issue'],
  'gpt':          ['colorfastness-fail','shrinkage-out-of-spec','pilling'],
  'pp-fit':       ['chest-too-tight','chest-too-loose','waist-off','length-too-short','length-too-long','silhouette-wrong','measurement-out-of-spec'],
}

// Which pre-prod stages each reviewer role is responsible for
const ROLE_STAGE_KEYS: Record<string, string[]> = {
  'designer':       ['lab-dip', 'strike-off', 'pp-sample'],
  'fit-technician': ['fit-sample', 'pp-fit', 'pp-sample'],
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isUnlocked(o: SubOrder) {
  return o.costStatus === 'approved' || o.preProdUnlocked === true
}

type QItem = {
  kind: 'review' | 'start'
  order: SubOrder
  stage: PreProdStage
  stageIdx: number
  iter?: PreProdIteration
}

// ─── Photo upload zone (functional — reads files to data URLs) ─────────────────

function PhotoUploadZone({ photos, onChange, max = 3, accent = C.primary }: {
  photos: string[]
  onChange: (next: string[]) => void
  max?: number
  accent?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - photos.length)
    Promise.all(files.map(f => new Promise<string>(res => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result as string)
      reader.readAsDataURL(f)
    }))).then(urls => onChange([...photos, ...urls].slice(0, max)))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((url, i) => (
          <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
            <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: `1px solid ${C.border}` }} />
            <button onClick={() => onChange(photos.filter((_, j) => j !== i))}
              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: C.danger, color: '#fff', border: '2px solid #fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <X size={11} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button onClick={() => inputRef.current?.click()}
            style={{ width: 72, height: 72, borderRadius: 10, border: `1.5px dashed ${accent}`, background: C.subtle, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: accent }}>
            <Upload size={16} />
            <span style={{ fontSize: 9, fontWeight: 600 }}>Add</span>
          </button>
        )}
      </div>
      <p style={{ fontSize: 10, color: C.ter, marginTop: 6 }}>JPG / PNG · up to {max} photos</p>
    </div>
  )
}

// ─── Start-Stage Modal (reviewer initiates a not-started stage) ────────────────

function StartStageModal({ item, onClose, onStart }: {
  item: QItem
  onClose: () => void
  onStart: (orderId: string, stageKey: string, photos: string[], notes: string) => void
}) {
  const [photos, setPhotos] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const canSubmit = photos.length >= 1

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 18, boxShadow: '0 12px 48px rgba(0,0,0,0.18)', width: '100%', maxWidth: 460, padding: 22, fontFamily: 'Inter, system-ui, sans-serif', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Start {item.stage.name}</h2>
            <p style={{ fontSize: 12, color: C.sec, marginTop: 2 }}>{item.order.styleCode} · {item.order.colour} · {item.order.vendor.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ter }}><X size={18} /></button>
        </div>

        <div style={{ background: C.infoBg, border: `1px solid ${C.infoBorder}`, borderRadius: 10, padding: '8px 12px', margin: '12px 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <FlaskConical size={14} color={C.info} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11.5, color: '#1E3A8A' }}>You're logging this sample on receipt. Upload a photo to start the approval record — it'll then move to review.</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>Sample photo <span style={{ color: C.danger }}>*</span></label>
          <PhotoUploadZone photos={photos} onChange={setPhotos} accent={C.info} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>Notes <span style={{ fontWeight: 400, color: C.ter }}>(optional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Any context for this submission…"
            style={{ width: '100%', fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 500, background: C.surface, cursor: 'pointer', color: C.sec }}>Cancel</button>
          <button onClick={() => canSubmit && onStart(item.order.id, item.stage.stageKey, photos, notes)} disabled={!canSubmit}
            style={{ padding: '9px 18px', background: canSubmit ? C.primary : C.ter, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            Start & Submit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stage Review Drawer ──────────────────────────────────────────────────────

function StageReviewDrawer({ item, onClose, onApprove, onReject }: {
  item: QItem
  onClose: () => void
  onApprove: (orderId: string, stageKey: string, notes: string, photos: string[]) => void
  onReject: (orderId: string, stageKey: string, notes: string, tags: string[]) => void
}) {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<'view' | 'approve' | 'reject'>('view')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [photoIdx, setPhotoIdx] = useState(0)
  const [addedPhotos, setAddedPhotos] = useState<string[]>([])

  const vocab = REJECTION_TAGS[item.stage.stageKey] ?? []

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300) }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const photos = [...(item.iter?.photos ?? []), ...addedPhotos]

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', zIndex: 40, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100%', width: '100%', maxWidth: 720,
        background: C.surface, boxShadow: '-4px 0 32px rgba(0,0,0,0.12)', zIndex: 50,
        transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease-out',
        display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ter, padding: 4, borderRadius: 6 }}><X size={18} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {item.stage.name}
              {item.stage.pastIterations.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                  Round {(item.stage.pastIterations.length) + 1}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.sec, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.order.styleCode} · {item.order.colour} · {item.order.vendor.name}
            </div>
          </div>
          <a href={`/portfolio/${item.order.id}?tab=pre-prod`} style={{ fontSize: 12, color: C.primary, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>View order →</a>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Context strip */}
          <div style={{ background: C.subtle, borderRadius: 12, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Style', value: item.order.styleName },
              { label: 'Category', value: item.order.category },
              { label: 'POC', value: item.order.poc.name },
              { label: 'Planned', value: fmtDate(item.stage.plannedDate) },
              { label: 'Submitted', value: item.iter ? fmtDate(item.iter.submittedAt) : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: C.ter, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Photos */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.sec }}>Sample photos</span>
            </div>
            {photos.length > 0 ? (
              <>
                <img src={photos[Math.min(photoIdx, photos.length - 1)]} alt="Sample"
                  style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12, border: `1px solid ${C.border}`, background: C.subtle }} />
                {photos.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {photos.map((url, i) => (
                      <img key={i} src={url} alt="" onClick={() => setPhotoIdx(i)}
                        style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: `2px solid ${i === photoIdx ? C.primary : C.border}`, cursor: 'pointer' }} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: C.subtle, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '24px 0', textAlign: 'center' }}>
                <ImageIcon size={22} color={C.ter} style={{ margin: '0 auto 6px' }} />
                <p style={{ fontSize: 12, color: C.ter }}>No photos on this submission yet</p>
              </div>
            )}
            {/* Reviewer can add their own photo of the physical sample */}
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.sec, marginBottom: 6 }}>Add your photo of the sample</p>
              <PhotoUploadZone photos={addedPhotos} onChange={setAddedPhotos} />
            </div>
          </div>

          {/* Submission note */}
          {item.iter?.approvalNotes && (
            <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.amber, marginBottom: 2 }}>Submission note</p>
              <p style={{ fontSize: 12, color: C.text }}>{item.iter.approvalNotes}</p>
            </div>
          )}

          {/* Past iterations */}
          {item.stage.pastIterations.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.sec, marginBottom: 8 }}>Previous rounds</div>
              {item.stage.pastIterations.map(pi => (
                <div key={pi.id} style={{ background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.danger }}>Round {pi.iterationNumber} — Rejected {pi.reviewedAt ? fmtDate(pi.reviewedAt) : ''}</p>
                  {pi.rejectionTags && pi.rejectionTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {pi.rejectionTags.map(t => (
                        <span key={t} style={{ fontSize: 10, background: '#FEE2E2', color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 20, padding: '2px 8px' }}>{TAG_LABELS[t] ?? t}</span>
                      ))}
                    </div>
                  )}
                  {pi.rejectionNotes && <p style={{ fontSize: 12, color: '#7F1D1D', marginTop: 4, fontStyle: 'italic' }}>"{pi.rejectionNotes}"</p>}
                </div>
              ))}
            </div>
          )}

          {/* Approve form */}
          {mode === 'approve' && (
            <div style={{ background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.success, marginBottom: 10 }}>Approve {item.stage.name}</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional approval notes…"
                style={{ width: '100%', fontSize: 12, border: `1px solid ${C.successBorder}`, borderRadius: 8, padding: '8px 10px', resize: 'none', fontFamily: 'inherit', outline: 'none', background: C.surface, color: C.text, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setMode('view')} style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 500, background: C.surface, cursor: 'pointer' }}>Back</button>
                <button onClick={() => { onApprove(item.order.id, item.stage.stageKey, notes, addedPhotos); handleClose() }}
                  style={{ padding: '8px 18px', background: C.success, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Confirm Approval</button>
              </div>
            </div>
          )}

          {/* Reject form */}
          {mode === 'reject' && (
            <div style={{ background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.danger, marginBottom: 10 }}>Reject {item.stage.name}</p>
              {vocab.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.sec, marginBottom: 6 }}>Tags <span style={{ fontWeight: 400, color: C.ter }}>(optional)</span></p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {vocab.map(t => (
                      <button key={t} onClick={() => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `1px solid ${tags.includes(t) ? C.danger : C.border}`, background: tags.includes(t) ? '#FEE2E2' : C.surface, color: tags.includes(t) ? C.danger : C.sec, cursor: 'pointer', fontWeight: tags.includes(t) ? 600 : 400 }}>
                        {TAG_LABELS[t] ?? t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Describe the issue clearly so the vendor knows what to fix… (min 10 chars)"
                style={{ width: '100%', fontSize: 12, border: `1px solid ${C.dangerBorder}`, borderRadius: 8, padding: '8px 10px', resize: 'none', fontFamily: 'inherit', outline: 'none', background: C.surface, color: C.text, boxSizing: 'border-box' }} />
              {notes.length > 0 && notes.length < 10 && <p style={{ fontSize: 10, color: C.danger, marginTop: 4 }}>Please write at least 10 characters.</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setMode('view')} style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 500, background: C.surface, cursor: 'pointer' }}>Back</button>
                <button onClick={() => { if (notes.trim().length >= 10) { onReject(item.order.id, item.stage.stageKey, notes.trim(), tags); handleClose() } }} disabled={notes.trim().length < 10}
                  style={{ padding: '8px 18px', background: notes.trim().length >= 10 ? C.danger : C.ter, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: notes.trim().length >= 10 ? 'pointer' : 'not-allowed' }}>Confirm Rejection</button>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        {mode === 'view' && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: C.surface }}>
            <button onClick={handleClose} style={{ padding: '9px 16px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 500, background: C.surface, cursor: 'pointer', color: C.sec }}>Close</button>
            <button onClick={() => setMode('reject')} style={{ padding: '9px 16px', border: `1px solid ${C.dangerBorder}`, color: C.danger, borderRadius: 10, fontSize: 13, fontWeight: 600, background: C.surface, cursor: 'pointer' }}>Reject</button>
            <button onClick={() => setMode('approve')} style={{ padding: '9px 18px', background: C.success, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} /> Approve
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PreProdPageInner() {
  const { currentUser } = useCurrentUser()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'queue'

  const [drawerItem, setDrawerItem] = useState<QItem | null>(null)
  const [startItem, setStartItem]   = useState<QItem | null>(null)
  const [acted, setActed]     = useState<Record<string, 'approved' | 'rejected'>>({})
  const [started, setStarted] = useState<Record<string, boolean>>({})
  const [flash, setFlash]     = useState<string | null>(null)

  // Filters
  const [stageFilter, setStageFilter]   = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<'all' | 'review' | 'start'>('all')

  const role = currentUser.role
  const isReviewer = role === 'designer' || role === 'fit-technician'
  const myStageKeys = ROLE_STAGE_KEYS[role] ?? []
  const today = new Date().toISOString().split('T')[0]

  // Sidebar stage sub-items drive the stage filter via ?tab=<stageKey>
  const tabParam = searchParams.get('tab')
  useEffect(() => {
    setStageFilter(tabParam && myStageKeys.includes(tabParam) ? tabParam : 'all')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam, role])

  function showFlash(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2800)
  }

  // Review items — pending submissions for my stages
  const reviewItems = useMemo<QItem[]>(() => {
    const items: QItem[] = []
    for (const order of subOrders) {
      if (order.currentStage !== 'pre-prod') continue
      order.preProdStages.forEach((stage, si) => {
        const iter = stage.currentIteration
        if (!iter || iter.status !== 'pending') return
        if (!myStageKeys.includes(stage.stageKey)) return
        if (acted[`${order.id}-${stage.stageKey}`]) return
        if (started[`${order.id}-${stage.stageKey}`]) return
        items.push({ kind: 'review', order, stage, stageIdx: si, iter })
      })
    }
    return items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, acted, started])

  // Start items — not-started stages I can initiate (only when pre-prod unlocked)
  const startCandidates = useMemo<QItem[]>(() => {
    const items: QItem[] = []
    for (const order of subOrders) {
      if (order.currentStage !== 'pre-prod') continue
      if (!isUnlocked(order)) continue   // gate: only when pre-prod is unlocked
      for (let si = 0; si < order.preProdStages.length; si++) {
        const stage = order.preProdStages[si]
        if (stage.currentIteration) continue
        if (!myStageKeys.includes(stage.stageKey)) continue
        if (started[`${order.id}-${stage.stageKey}`]) continue
        const prev = order.preProdStages[si - 1]
        const prevApproved = si === 0 || prev?.status === 'approved' || prev?.currentIteration?.status === 'approved'
        if (!prevApproved) continue
        items.push({ kind: 'start', order, stage, stageIdx: si })
        break // earliest ready stage per order only
      }
    }
    return items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, started])

  // History — my past decisions
  const historyItems = useMemo(() => {
    const items: { order: SubOrder; stage: PreProdStage; iter: PreProdIteration }[] = []
    for (const order of subOrders) {
      for (const stage of order.preProdStages) {
        const collect = (iter: PreProdIteration) => {
          if (iter.reviewedById !== currentUser.id) return
          if (iter.status === 'pending') return
          items.push({ order, stage, iter })
        }
        if (stage.currentIteration) collect(stage.currentIteration)
        stage.pastIterations.forEach(collect)
      }
    }
    return items.sort((a, b) => (b.iter.reviewedAt ?? '').localeCompare(a.iter.reviewedAt ?? ''))
  }, [currentUser.id])

  // Combined + filtered
  const allItems = useMemo(() => {
    const merged = [...reviewItems, ...startCandidates]
    return merged
      .filter(it => actionFilter === 'all' || it.kind === actionFilter)
      .filter(it => stageFilter === 'all' || it.stage.stageKey === stageFilter)
      .sort((a, b) => {
        const aod = a.stage.plannedDate < today ? 0 : 1
        const bod = b.stage.plannedDate < today ? 0 : 1
        if (aod !== bod) return aod - bod
        return a.stage.plannedDate.localeCompare(b.stage.plannedDate)
      })
  }, [reviewItems, startCandidates, actionFilter, stageFilter, today])

  function handleApprove(orderId: string, stageKey: string) {
    setActed(prev => ({ ...prev, [`${orderId}-${stageKey}`]: 'approved' }))
    showFlash('Approved — recorded in your history.')
  }
  function handleReject(orderId: string, stageKey: string) {
    setActed(prev => ({ ...prev, [`${orderId}-${stageKey}`]: 'rejected' }))
    showFlash('Rejected — vendor & POC notified.')
  }
  function handleStart(orderId: string, stageKey: string) {
    setStarted(prev => ({ ...prev, [`${orderId}-${stageKey}`]: true }))
    setStartItem(null)
    showFlash('Stage started — submitted for review.')
  }

  // Stage chips relevant to this role (+ count)
  const stageChips = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const it of [...reviewItems, ...startCandidates]) {
      counts[it.stage.stageKey] = (counts[it.stage.stageKey] ?? 0) + 1
    }
    return myStageKeys
      .map(k => ({ key: k, name: subOrders.flatMap(o => o.preProdStages).find(s => s.stageKey === k)?.name ?? k, count: counts[k] ?? 0 }))
      .filter(c => c.count > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewItems, startCandidates])

  const reviewCount = reviewItems.length
  const startCount  = startCandidates.length

  // ── Non-reviewer guard ──
  if (!isReviewer) {
    return (
      <div className="ml-0 md:ml-[var(--ds-sidebar-width)]" style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Header title="Pre-Production" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, padding: 24 }}>
          <p style={{ fontSize: 14, color: C.ter, textAlign: 'center' }}>This view is for Designers and Fit Technicians.</p>
        </div>
      </div>
    )
  }

  const pillBase: React.CSSProperties = { flexShrink: 0, padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.surface, color: C.sec, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }
  const pillActive: React.CSSProperties = { background: C.primaryLight, borderColor: C.primary, color: C.primaryDark, fontWeight: 600 }

  return (
    <div className="ml-0 md:ml-[var(--ds-sidebar-width)]" style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Header title="Pre-Production" />

      {/* Flash toast */}
      {flash && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 70, background: C.text, color: '#fff', fontSize: 13, fontWeight: 500, padding: '10px 18px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} /> {flash}
        </div>
      )}

      <div className="px-4 py-5 md:px-7 md:py-6" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4, background: C.subtle, padding: 4, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 18, width: 'fit-content' }}>
          {[
            { key: 'queue', label: 'My Queue', badge: reviewCount + startCount },
            { key: 'history', label: 'My History', badge: 0 },
          ].map(tab => (
            <a key={tab.key} href={`/pre-prod?view=${tab.key}`}
              style={{ padding: '7px 16px', borderRadius: 9, fontSize: 13, fontWeight: view === tab.key ? 600 : 500, background: view === tab.key ? C.surface : 'transparent', color: view === tab.key ? C.primary : C.sec, boxShadow: view === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.label}
              {tab.badge > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: C.danger, color: '#fff', borderRadius: 20, padding: '1px 6px' }}>{tab.badge}</span>}
            </a>
          ))}
        </div>

        {/* ── QUEUE ── */}
        {view === 'queue' && (
          <div>
            {/* Heading */}
            <div style={{ marginBottom: 14 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                {reviewCount + startCount > 0 ? 'Your pre-production queue' : "You're all caught up"}
              </h1>
              <p style={{ fontSize: 13, color: C.sec, marginTop: 4 }}>
                {currentUser.roleLabel} · {reviewCount} to review · {startCount} to start
              </p>
            </div>

            {/* Filters */}
            <div style={{ marginBottom: 16 }}>
              {/* Action filter */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 8 }}>
                {([
                  { key: 'all',    label: 'All',        n: reviewCount + startCount },
                  { key: 'review', label: 'To Review',  n: reviewCount },
                  { key: 'start',  label: 'To Start',   n: startCount },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setActionFilter(f.key)} style={{ ...pillBase, ...(actionFilter === f.key ? pillActive : {}) }}>
                    {f.key === 'start' && <Plus size={12} />}
                    {f.label}
                    <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}>{f.n}</span>
                  </button>
                ))}
              </div>
              {/* Stage-type filter */}
              {stageChips.length > 0 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
                  <SlidersHorizontal size={13} color={C.ter} style={{ flexShrink: 0 }} />
                  <button onClick={() => setStageFilter('all')} style={{ ...pillBase, ...(stageFilter === 'all' ? pillActive : {}) }}>All stages</button>
                  {stageChips.map(c => (
                    <button key={c.key} onClick={() => setStageFilter(c.key)} style={{ ...pillBase, ...(stageFilter === c.key ? pillActive : {}) }}>
                      {c.name}<span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}>{c.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Empty */}
            {allItems.length === 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 16px', textAlign: 'center' }}>
                <CheckCircle2 size={36} color="#2E7D52" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Nothing here</p>
                <p style={{ fontSize: 13, color: C.sec, marginTop: 6 }}>{reviewCount + startCount === 0 ? 'No pre-production work waiting for you.' : 'No items match this filter.'}</p>
              </div>
            )}

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allItems.map(item => {
                const isStart = item.kind === 'start'
                const isOverdue = item.stage.plannedDate < today
                const roundNum = item.stage.pastIterations.length + 1
                const accent = isStart ? C.info : C.amber
                const accentBg = isStart ? C.infoBg : C.amberBg
                const accentBorder = isStart ? C.infoBorder : C.amberBorder
                return (
                  <div key={`${item.kind}-${item.order.id}-${item.stage.stageKey}`}
                    onClick={() => isStart ? setStartItem(item) : setDrawerItem(item)}
                    style={{ background: C.surface, border: `1px solid ${isOverdue && !isStart ? '#FCA5A5' : C.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.primary; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(204,120,92,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isOverdue && !isStart ? '#FCA5A5' : C.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: accentBg, border: `1px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isStart ? <Plus size={18} color={accent} /> : <FlaskConical size={17} color={accent} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.order.styleCode} · {item.order.colour}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, background: isStart ? C.infoBg : '#FEF3C7', color: accent, border: `1px solid ${accentBorder}`, borderRadius: 20, padding: '2px 8px' }}>{item.stage.name}</span>
                          {isStart ? (
                            <span style={{ fontSize: 11, fontWeight: 600, background: C.infoBg, color: C.info, border: `1px solid ${C.infoBorder}`, borderRadius: 20, padding: '2px 8px' }}>Ready to start</span>
                          ) : (
                            <>
                              {roundNum > 1 && <span style={{ fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 20, padding: '2px 8px' }}>Round {roundNum}</span>}
                              {isOverdue && <span style={{ fontSize: 11, fontWeight: 600, background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 20, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={10} /> Overdue</span>}
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: C.sec, marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span>{item.order.styleName}</span>
                          <span>Vendor: {item.order.vendor.name}</span>
                          <span>POC: {item.order.poc.name}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.ter, marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span>Planned: {fmtDate(item.stage.plannedDate)}</span>
                          {item.iter && <span>Submitted: {fmtDate(item.iter.submittedAt)}</span>}
                          {item.iter?.photos && item.iter.photos.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ImageIcon size={11} /> {item.iter.photos.length} photo{item.iter.photos.length > 1 ? 's' : ''}</span>
                          )}
                          {isStart && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.success }}><CheckCircle2 size={11} /> Pre-prod unlocked</span>}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isStart ? C.info : C.primary }}>{isStart ? 'Start →' : 'Review →'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {view === 'history' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>My Approval History</h1>
              <p style={{ fontSize: 13, color: C.sec, marginTop: 4 }}>All past decisions — your institutional memory for sample approvals.</p>
            </div>
            {historyItems.length === 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 16px', textAlign: 'center' }}>
                <Clock size={32} color={C.ter} style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, color: C.sec }}>No history yet. Your decisions will appear here once you start reviewing samples.</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyItems.map(item => {
                const isApproved = item.iter.status === 'approved'
                return (
                  <div key={`${item.order.id}-${item.stage.stageKey}-${item.iter.id}`} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: isApproved ? '#D1FAE5' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isApproved ? <CheckCircle2 size={14} color="#059669" /> : <X size={14} color={C.danger} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.stage.name}</span>
                          <span style={{ fontSize: 11, color: C.sec }}>— {item.order.styleCode} {item.order.colour}</span>
                          <span style={{ fontSize: 11, color: C.ter }}>Round {item.iter.iterationNumber}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.sec, marginTop: 2 }}>{item.order.vendor.name} · POC: {item.order.poc.name}</div>
                        {!isApproved && item.iter.rejectionNotes && <p style={{ fontSize: 12, color: C.danger, marginTop: 4, fontStyle: 'italic' }}>"{item.iter.rejectionNotes}"</p>}
                        {!isApproved && item.iter.rejectionTags && item.iter.rejectionTags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {item.iter.rejectionTags.map(t => <span key={t} style={{ fontSize: 10, background: '#FEE2E2', color: C.danger, border: `1px solid ${C.dangerBorder}`, borderRadius: 20, padding: '2px 7px' }}>{TAG_LABELS[t] ?? t}</span>)}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: C.ter, flexShrink: 0, marginTop: 2 }}>{item.iter.reviewedAt ? fmtDate(item.iter.reviewedAt) : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drawer + Start modal */}
      {drawerItem && <StageReviewDrawer item={drawerItem} onClose={() => setDrawerItem(null)} onApprove={handleApprove} onReject={handleReject} />}
      {startItem && <StartStageModal item={startItem} onClose={() => setStartItem(null)} onStart={handleStart} />}
    </div>
  )
}

export default function PreProdPage() {
  return (
    <Suspense fallback={null}>
      <PreProdPageInner />
    </Suspense>
  )
}
