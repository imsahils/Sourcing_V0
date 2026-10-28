'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { OpenCostingBreakdown } from '@/lib/vendor-costing'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CostStatus = 'no-vendor' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'escalated'

// Second-level sign-off by the Buying team, after Sourcing (level 1) has approved.
// 'pending'  — awaiting Buying decision
// 'approved' — Buying signed off (costing fully locked)
// 'revision' — Buying sent it back to Sourcing/vendor for a revised quote
// 'rejected' — Buying rejected the costing outright
export type BuyingApprovalStatus = 'pending' | 'approved' | 'revision' | 'rejected'

// One entry in a style's costing audit trail. Costing can go through several
// rounds — each rejection / revision sends it back and the vendor resubmits.
export type CostingEventType =
  | 'submitted'           // vendor submitted open costing
  | 'resubmitted'         // vendor submitted a revised quote (new round)
  | 'sourcing-approved'   // level-1 sign-off
  | 'buying-approved'     // level-2 sign-off
  | 'revision-requested'  // Buying sent back for a revised quote
  | 'rejected'            // Buying rejected outright

export type CostingEvent = {
  round: number
  type: CostingEventType
  by: string
  role: string            // 'Vendor' | 'Sourcing POC' | 'Sourcing Manager' | 'Category Head' | 'Buying POC'
  date: string
  comment?: string
  cost?: number           // open-costing total/pc captured at this event
  breakdown?: OpenCostingBreakdown
}

export type CostingOrder = {
  id: string
  styleCode: string
  styleName: string
  colour: string
  category: string
  vendor: string
  vendorLocation: string
  vendorId: string
  orderQty: number
  targetPrice: number
  costStatus: CostStatus
  buyingExpectedDate: string
  vendorTargetDate: string
  season: string
  submittedCost?: number
  breakdown?: OpenCostingBreakdown
  submittedOn?: string
  approvedBy?: string           // Sourcing (level-1) approver
  approvedOn?: string
  approverRole?: string         // 'Sourcing POC' | 'Sourcing Manager' | 'Category Head'
  // ─── Buying team (level-2) sign-off ──────────────────────────
  buyingStatus?: BuyingApprovalStatus
  buyingDecisionBy?: string
  buyingDecisionOn?: string
  buyingFeedback?: string       // revision / rejection note from Buying
  round?: number                // current costing round (1-based)
  history?: CostingEvent[]      // full audit trail across rounds
  rejectedReason?: string
  escalationReason?: string
  notes?: string
  confirmedInwardDate?: string
  inwardDateConfirmed?: boolean
  parentId?: string
  isSplit?: boolean
  splitSeq?: number
}

export type RFQStatus = 'sent' | 'responded' | 'overdue' | 'cancelled'

export type RFQRecord = {
  id: string
  orderId: string
  styleCode: string
  styleName: string
  colour: string
  category: string
  orderQty: number
  targetPrice: number
  vendorId: string
  vendorName: string
  vendorLocation: string
  sentDate: string
  dueDate: string
  status: RFQStatus
  submittedCost?: number
  breakdown?: OpenCostingBreakdown
  notes?: string
  responseDate?: string
  promisedInwardDate?: string
  followedUpAt?: string
}

export type SplitEntry = { vendorId: string; qty: number }

// ─── Seed data ────────────────────────────────────────────────────────────────

const INITIAL_ORDERS: CostingOrder[] = [
  // Scenario 1: No vendor assigned yet
  {
    id: 'NNKNTW250010', styleCode: 'NN407-221', styleName: 'Girls Tiered Floral Dress',
    colour: 'PEACH', category: 'Wovens', vendor: '', vendorLocation: '', vendorId: '',
    orderQty: 600, targetPrice: 265, costStatus: 'no-vendor',
    buyingExpectedDate: '2026-06-30', vendorTargetDate: '2026-06-15',
    season: 'SS25',
  },
  // Scenario 2: Vendor assigned, quote not yet submitted
  {
    id: 'NNKNTW250011', styleCode: 'NN412-089', styleName: 'Boys Cargo Jogger',
    colour: 'OLIVE', category: 'Wovens', vendor: 'IDS FASHION', vendorLocation: 'NOIDA', vendorId: 'v3',
    orderQty: 450, targetPrice: 320, costStatus: 'pending',
    buyingExpectedDate: '2026-06-25', vendorTargetDate: '2026-06-10',
    season: 'SS25',
  },
  // Scenario 3: Quote submitted — under target
  {
    id: 'NNKNTW250012', styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', category: 'Knits', vendor: 'BS FASHION', vendorLocation: 'KOLKATA', vendorId: 'v4',
    orderQty: 720, targetPrice: 340, costStatus: 'submitted',
    submittedCost: 326,
    breakdown: { mainFabricPrice: 95, mainFabricConsumption: 1.4, trimFabricPrice: 24, trimFabricConsumption: 0.35, trimCostThread: 40, cmp: 82, valueAddition: 28, testing: 12, logistic: 8, rejectionPct: 2, marginPct: 3 },
    submittedOn: '2026-04-27',
    buyingExpectedDate: '2026-06-15', vendorTargetDate: '2026-05-30',
    season: 'SS25',
    notes: 'Able to reduce CMT by 4% by co-loading with another order. Fabric sourced at prev. season price.',
  },
  // Scenario 4: Quote submitted — slightly over target
  {
    id: 'NNKNTW250013', styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', category: 'Wovens', vendor: 'DIV CREATIONS', vendorLocation: 'FARIDABAD', vendorId: 'v5',
    orderQty: 380, targetPrice: 295, costStatus: 'submitted',
    submittedCost: 310,
    breakdown: { mainFabricPrice: 108, mainFabricConsumption: 1.2, trimFabricPrice: 20, trimFabricConsumption: 0.3, trimCostThread: 36, cmp: 84, valueAddition: 0, testing: 10, logistic: 8, rejectionPct: 2, marginPct: 12 },
    submittedOn: '2026-04-26',
    buyingExpectedDate: '2026-06-20', vendorTargetDate: '2026-06-05',
    season: 'SS25',
    notes: 'Linen blend yarn cost up 6% vs last season. Vendor proposes using 55/45 blend vs 60/40 to meet target — seeking POC direction.',
  },
  // Scenario 5: Escalated
  {
    id: 'NNKNTW250015', styleCode: 'NN415-078', styleName: 'Boys French Terry Sweatshirt',
    colour: 'NAVY MELANGE', category: 'Knits', vendor: 'CAARVI TEXTILES', vendorLocation: 'DELHI', vendorId: 'v8',
    orderQty: 550, targetPrice: 380, costStatus: 'escalated',
    submittedCost: 434,
    breakdown: { mainFabricPrice: 130, mainFabricConsumption: 1.5, trimFabricPrice: 22, trimFabricConsumption: 0.4, trimCostThread: 44, cmp: 94, valueAddition: 42, testing: 12, logistic: 8, rejectionPct: 2, marginPct: 6 },
    submittedOn: '2026-04-24',
    buyingExpectedDate: '2026-07-05', vendorTargetDate: '2026-06-20',
    season: 'SS25',
    escalationReason: 'Vendor cost exceeds target by 14.2% — auto-escalated to category head for approval.',
    notes: 'French terry yarn prices elevated due to cotton futures spike. Vendor has confirmed no scope for reduction without quality compromise.',
  },
  // Scenario 6: Escalated awaiting category head
  {
    id: 'NNKNTW250018', styleCode: 'NN422-190', styleName: 'Girls Velvet Pinafore',
    colour: 'BURGUNDY', category: 'Wovens', vendor: 'ADITEE INTERNATIONAL', vendorLocation: 'JAIPUR', vendorId: 'v7',
    orderQty: 300, targetPrice: 480, costStatus: 'escalated',
    submittedCost: 545,
    breakdown: { mainFabricPrice: 158, mainFabricConsumption: 1.5, trimFabricPrice: 25, trimFabricConsumption: 0.5, trimCostThread: 68, cmp: 116, valueAddition: 44, testing: 14, logistic: 12, rejectionPct: 2, marginPct: 7 },
    submittedOn: '2026-04-22',
    buyingExpectedDate: '2026-07-15', vendorTargetDate: '2026-07-01',
    season: 'SS25',
    escalationReason: 'Velvet sourcing cost +13.5% over target. Category head approval pending since 26-Apr.',
    notes: 'Italian-origin velvet substitute proposed at ₹498 — category head reviewing quality sample before sign-off.',
  },
  // Scenario 7: Rejected
  {
    id: 'NNKNTW250019', styleCode: 'NN418-067', styleName: 'Boys Printed Co-ord Set',
    colour: 'MULTI', category: 'Knits', vendor: 'PESOS VISION', vendorLocation: 'MUMBAI', vendorId: 'v9',
    orderQty: 480, targetPrice: 355, costStatus: 'rejected',
    buyingExpectedDate: '2026-06-27', vendorTargetDate: '2026-06-12',
    season: 'SS25',
    rejectedReason: 'CMT quoted at ₹115 vs benchmark of ₹85 for similar product. Please renegotiate — target is achievable based on prior season data.',
  },
  // Scenario 8: Approved — inward date not yet confirmed
  {
    id: 'NNKNTW250016', styleCode: 'NN408-245', styleName: 'Girls Embroidered Sharara Set',
    colour: 'MAROON', category: 'Wovens', vendor: 'ARIHANT FASHIONS', vendorLocation: 'KOLKATA', vendorId: 'v2',
    orderQty: 280, targetPrice: 520, costStatus: 'approved',
    submittedCost: 498,
    breakdown: { mainFabricPrice: 138, mainFabricConsumption: 1.5, trimFabricPrice: 26, trimFabricConsumption: 0.5, trimCostThread: 58, cmp: 116, valueAddition: 50, testing: 12, logistic: 8, rejectionPct: 2, marginPct: 5.5 },
    submittedOn: '2026-04-18', approvedBy: 'Parthipan Kumar', approvedOn: '2026-04-22', approverRole: 'Sourcing POC',
    buyingStatus: 'pending',
    buyingExpectedDate: '2026-06-25', vendorTargetDate: '2026-06-10',
    season: 'SS25',
    notes: 'Zari work cost elevated. Approved — within acceptable 4.2% under target range.',
  },
  // Scenario 9: Approved + vendor confirmed inward date
  {
    id: 'NNKNTW250014', styleCode: 'NN401-190', styleName: 'Girls Printed Balloon Dress',
    colour: 'CORAL', category: 'Knits', vendor: 'AND DESIGN', vendorLocation: 'JAIPUR', vendorId: 'v6',
    orderQty: 900, targetPrice: 245, costStatus: 'approved',
    submittedCost: 238,
    breakdown: { mainFabricPrice: 72, mainFabricConsumption: 1.2, trimFabricPrice: 18, trimFabricConsumption: 0.4, trimCostThread: 28, cmp: 72, valueAddition: 22, testing: 8, logistic: 6, rejectionPct: 2, marginPct: 2 },
    submittedOn: '2026-04-14', approvedBy: 'Parthipan Kumar', approvedOn: '2026-04-17', approverRole: 'Sourcing POC',
    buyingStatus: 'approved', buyingDecisionBy: 'Rahul Desai', buyingDecisionOn: '2026-04-18',
    buyingExpectedDate: '2026-06-12', vendorTargetDate: '2026-05-28',
    confirmedInwardDate: '2026-06-02', inwardDateConfirmed: true,
    season: 'SS25',
  },
  // Scenario 10: Full cycle — approved, date confirmed, PO raised
  {
    id: 'NNKNTW250017', styleCode: 'NN411-312', styleName: 'Boys Printed Bermuda Shorts',
    colour: 'COBALT', category: 'Wovens', vendor: 'PESOS VISION', vendorLocation: 'MUMBAI', vendorId: 'v9',
    orderQty: 650, targetPrice: 198, costStatus: 'approved',
    submittedCost: 192,
    breakdown: { mainFabricPrice: 58, mainFabricConsumption: 1.2, trimFabricPrice: 16, trimFabricConsumption: 0.3, trimCostThread: 24, cmp: 58, valueAddition: 18, testing: 6, logistic: 4, rejectionPct: 2, marginPct: 2 },
    submittedOn: '2026-04-10', approvedBy: 'Parthipan Kumar', approvedOn: '2026-04-12', approverRole: 'Sourcing POC',
    buyingStatus: 'approved', buyingDecisionBy: 'Rahul Desai', buyingDecisionOn: '2026-04-13',
    buyingExpectedDate: '2026-06-01', vendorTargetDate: '2026-05-15',
    confirmedInwardDate: '2026-05-22', inwardDateConfirmed: true,
    season: 'SS25',
  },
  // Bharti Apparels orders from vendor-costing.ts v1
  {
    id: 'NNKNTW250032', styleCode: 'NN432-205', styleName: 'Girls Palazzo Set',
    colour: 'LAVENDER', category: 'Wovens', vendor: 'BHARTI APPARELS', vendorLocation: 'FARIDABAD', vendorId: 'v1',
    orderQty: 350, targetPrice: 420, costStatus: 'submitted',
    submittedCost: 398,
    breakdown: {
      mainFabricPrice: 115, mainFabricConsumption: 1.5,
      trimFabricPrice: 22, trimFabricConsumption: 0.4,
      trimCostThread: 52, cmp: 96, valueAddition: 38,
      testing: 12, logistic: 8, rejectionPct: 2, marginPct: 2.5,
    },
    notes: 'Fabric cost elevated due to yarn dyed woven; CMT competitive.',
    submittedOn: '2026-04-18',
    buyingExpectedDate: '2026-06-28', vendorTargetDate: '2026-06-13',
    season: 'AW26',
  },
  {
    id: 'NNKNTW250035', styleCode: 'NN435-310', styleName: 'Girls Tiered Skirt',
    colour: 'PEACH', category: 'Wovens', vendor: 'BHARTI APPARELS', vendorLocation: 'FARIDABAD', vendorId: 'v1',
    orderQty: 480, targetPrice: 295, costStatus: 'escalated',
    submittedCost: 342,
    breakdown: {
      mainFabricPrice: 98, mainFabricConsumption: 1.4,
      trimFabricPrice: 18, trimFabricConsumption: 0.5,
      trimCostThread: 42, cmp: 88, valueAddition: 20,
      testing: 12, logistic: 14, rejectionPct: 3, marginPct: 5,
    },
    notes: 'Fabric sourced from premium mill.',
    submittedOn: '2026-04-22',
    escalationReason: 'Quote is significantly above acceptable range. Please review fabric and CMT components and resubmit.',
    buyingExpectedDate: '2026-07-05', vendorTargetDate: '2026-06-20',
    season: 'AW26',
  },
  {
    id: 'NNKNTW250036', styleCode: 'NN436-088', styleName: 'Boys Oxford Shirt',
    colour: 'WHITE', category: 'Wovens', vendor: 'BHARTI APPARELS', vendorLocation: 'FARIDABAD', vendorId: 'v1',
    orderQty: 720, targetPrice: 260, costStatus: 'approved',
    submittedCost: 248,
    breakdown: {
      mainFabricPrice: 88, mainFabricConsumption: 1.3,
      trimFabricPrice: 14, trimFabricConsumption: 0.35,
      trimCostThread: 34, cmp: 72, valueAddition: 0,
      testing: 8, logistic: 6, rejectionPct: 2, marginPct: 2,
    },
    submittedOn: '2026-04-07',
    approvedBy: 'Parthipan Kumar', approvedOn: '2026-04-10', approverRole: 'Sourcing POC',
    buyingStatus: 'pending',
    buyingExpectedDate: '2026-05-30', vendorTargetDate: '2026-05-15',
    season: 'AW26',
  },
  // ── Additional Buying-queue styles (Sourcing-approved, awaiting Buying) ──────
  {
    id: 'NNKNTW250041', styleCode: 'NN441-120', styleName: 'Girls Ribbed Knit Co-ord Set',
    colour: 'TEAL', category: 'Knits', vendor: 'SWARA CREATION', vendorLocation: 'SURAT', vendorId: 'v10',
    orderQty: 540, targetPrice: 315, costStatus: 'approved',
    submittedCost: 298,
    breakdown: { mainFabricPrice: 88, mainFabricConsumption: 1.3, trimFabricPrice: 18, trimFabricConsumption: 0.3, trimCostThread: 34, cmp: 74, valueAddition: 20, testing: 9, logistic: 7, rejectionPct: 2, marginPct: 3 },
    submittedOn: '2026-05-04', approvedBy: 'Parthipan Kumar', approvedOn: '2026-05-06', approverRole: 'Sourcing POC',
    buyingStatus: 'pending',
    buyingExpectedDate: '2026-07-20', vendorTargetDate: '2026-07-05',
    season: 'AW26',
    notes: 'Ribbed knit sourced locally — competitive CMT, co-loaded with existing Surat order.',
  },
  {
    id: 'NNKNTW250042', styleCode: 'NN442-210', styleName: 'Boys Hooded Puffer Jacket',
    colour: 'NAVY', category: 'Wovens', vendor: 'CAARVI TEXTILES', vendorLocation: 'DELHI', vendorId: 'v8',
    orderQty: 380, targetPrice: 640, costStatus: 'approved',
    submittedCost: 668,
    breakdown: { mainFabricPrice: 150, mainFabricConsumption: 1.8, trimFabricPrice: 40, trimFabricConsumption: 0.6, trimCostThread: 72, cmp: 150, valueAddition: 30, testing: 14, logistic: 16, rejectionPct: 2, marginPct: 4 },
    submittedOn: '2026-05-05', approvedBy: 'Meena Iyer', approvedOn: '2026-05-08', approverRole: 'Sourcing Manager',
    buyingStatus: 'pending', round: 2,
    buyingExpectedDate: '2026-08-10', vendorTargetDate: '2026-07-25',
    season: 'AW26',
    notes: 'Poly-fill cost up 5% this season; revised quote after Buying feedback — now +4.4% over target.',
    history: [
      { round: 1, type: 'submitted', by: 'CAARVI TEXTILES', role: 'Vendor', date: '2026-04-28', cost: 712,
        breakdown: { mainFabricPrice: 160, mainFabricConsumption: 1.8, trimFabricPrice: 42, trimFabricConsumption: 0.6, trimCostThread: 78, cmp: 162, valueAddition: 34, testing: 14, logistic: 16, rejectionPct: 2, marginPct: 5 } },
      { round: 1, type: 'sourcing-approved', by: 'Meena Iyer', role: 'Sourcing Manager', date: '2026-04-30' },
      { round: 1, type: 'revision-requested', by: 'Rahul Desai', role: 'Buying POC', date: '2026-05-01',
        comment: 'Quote is ~11% over target. Fill GSM looks high for the price band — please renegotiate poly-fill and CMP and resubmit.' },
      { round: 2, type: 'resubmitted', by: 'CAARVI TEXTILES', role: 'Vendor', date: '2026-05-05', cost: 668,
        breakdown: { mainFabricPrice: 150, mainFabricConsumption: 1.8, trimFabricPrice: 40, trimFabricConsumption: 0.6, trimCostThread: 72, cmp: 150, valueAddition: 30, testing: 14, logistic: 16, rejectionPct: 2, marginPct: 4 } },
      { round: 2, type: 'sourcing-approved', by: 'Meena Iyer', role: 'Sourcing Manager', date: '2026-05-08' },
    ],
  },
  {
    id: 'NNKNTW250043', styleCode: 'NN443-055', styleName: 'Girls Sequin Party Dress',
    colour: 'MAROON', category: 'Wovens', vendor: 'ADITEE INTERNATIONAL', vendorLocation: 'JAIPUR', vendorId: 'v7',
    orderQty: 260, targetPrice: 560, costStatus: 'approved',
    submittedCost: 622,
    breakdown: { mainFabricPrice: 160, mainFabricConsumption: 1.6, trimFabricPrice: 30, trimFabricConsumption: 0.5, trimCostThread: 70, cmp: 128, valueAddition: 72, testing: 14, logistic: 12, rejectionPct: 2.5, marginPct: 6 },
    submittedOn: '2026-05-02', approvedBy: 'Arvind Rao', approvedOn: '2026-05-07', approverRole: 'Category Head',
    buyingStatus: 'rejected', buyingDecisionBy: 'Rahul Desai', buyingDecisionOn: '2026-05-09', round: 1,
    buyingFeedback: 'Margin unviable at this quote — sequin premium pushes it 11% over target with no MRP headroom. Rejecting; please re-source a simpler embellishment or drop the style.',
    rejectedReason: 'Margin unviable — 11% over target with no MRP headroom.',
    buyingExpectedDate: '2026-07-18', vendorTargetDate: '2026-07-02',
    season: 'SS25',
    notes: 'Hand-sequin work drives value addition; +11% over target — escalated and cleared by Category Head.',
    history: [
      { round: 1, type: 'submitted', by: 'ADITEE INTERNATIONAL', role: 'Vendor', date: '2026-05-02', cost: 622,
        breakdown: { mainFabricPrice: 160, mainFabricConsumption: 1.6, trimFabricPrice: 30, trimFabricConsumption: 0.5, trimCostThread: 70, cmp: 128, valueAddition: 72, testing: 14, logistic: 12, rejectionPct: 2.5, marginPct: 6 } },
      { round: 1, type: 'sourcing-approved', by: 'Arvind Rao', role: 'Category Head', date: '2026-05-07',
        comment: 'Above 5% band — reviewed embellishment sample, costing is fair for the work. Cleared to Buying.' },
      { round: 1, type: 'rejected', by: 'Rahul Desai', role: 'Buying POC', date: '2026-05-09',
        comment: 'Margin unviable at this quote — sequin premium pushes it 11% over target with no MRP headroom. Rejecting; please re-source a simpler embellishment or drop the style.' },
    ],
  },
  {
    id: 'NNKNTW250044', styleCode: 'NN444-300', styleName: 'Boys Cotton Pique Polo',
    colour: 'WHITE', category: 'Knits', vendor: 'BS FASHION', vendorLocation: 'KOLKATA', vendorId: 'v4',
    orderQty: 820, targetPrice: 185, costStatus: 'approved',
    submittedCost: 172,
    breakdown: { mainFabricPrice: 58, mainFabricConsumption: 1.1, trimFabricPrice: 10, trimFabricConsumption: 0.25, trimCostThread: 20, cmp: 52, valueAddition: 0, testing: 7, logistic: 5, rejectionPct: 2, marginPct: 2 },
    submittedOn: '2026-05-03', approvedBy: 'Parthipan Kumar', approvedOn: '2026-05-05', approverRole: 'Sourcing POC',
    buyingStatus: 'pending',
    buyingExpectedDate: '2026-07-12', vendorTargetDate: '2026-06-28',
    season: 'SS25',
    notes: 'High-volume basic — 7% under target on strong CMT.',
  },
  {
    id: 'NNKNTW250045', styleCode: 'NN445-145', styleName: 'Girls Denim Pinafore',
    colour: 'BLUE', category: 'Wovens', vendor: 'DIV CREATIONS', vendorLocation: 'FARIDABAD', vendorId: 'v5',
    orderQty: 300, targetPrice: 430, costStatus: 'approved',
    submittedCost: 441,
    breakdown: { mainFabricPrice: 118, mainFabricConsumption: 1.5, trimFabricPrice: 22, trimFabricConsumption: 0.4, trimCostThread: 44, cmp: 92, valueAddition: 24, testing: 11, logistic: 9, rejectionPct: 2, marginPct: 4 },
    submittedOn: '2026-05-06', approvedBy: 'Meena Iyer', approvedOn: '2026-05-09', approverRole: 'Sourcing Manager',
    buyingStatus: 'pending',
    buyingExpectedDate: '2026-08-02', vendorTargetDate: '2026-07-18',
    season: 'AW26',
    notes: 'Denim rates firm; +2.6% over target — within Sourcing Manager band.',
  },
  {
    id: 'NNKNTW250046', styleCode: 'NN446-088', styleName: 'Boys Fleece Joggers',
    colour: 'OLIVE', category: 'Knits', vendor: 'AND DESIGN', vendorLocation: 'JAIPUR', vendorId: 'v6',
    orderQty: 600, targetPrice: 240, costStatus: 'approved',
    submittedCost: 225,
    breakdown: { mainFabricPrice: 70, mainFabricConsumption: 1.3, trimFabricPrice: 14, trimFabricConsumption: 0.3, trimCostThread: 26, cmp: 62, valueAddition: 12, testing: 8, logistic: 6, rejectionPct: 2, marginPct: 3 },
    submittedOn: '2026-05-04', approvedBy: 'Parthipan Kumar', approvedOn: '2026-05-06', approverRole: 'Sourcing POC',
    buyingStatus: 'pending',
    buyingExpectedDate: '2026-07-28', vendorTargetDate: '2026-07-14',
    season: 'AW26',
    notes: 'Fleece co-loaded with sweatshirt order — 6% under target.',
  },
  // Scenario: Split parent — order split across two vendors
  {
    id: 'NNKNTW250040', styleCode: 'NN440-180', styleName: 'Girls Printed Midi Dress',
    colour: 'TEAL PRINT', category: 'Knits', vendor: '', vendorLocation: '', vendorId: '',
    orderQty: 800, targetPrice: 310, costStatus: 'pending',
    isSplit: true,
    buyingExpectedDate: '2026-07-10', vendorTargetDate: '2026-06-25',
    season: 'AW26',
  },
  // Split child 1
  {
    id: 'NNKNTW250040-A', styleCode: 'NN440-180', styleName: 'Girls Printed Midi Dress',
    colour: 'TEAL PRINT', category: 'Knits', vendor: 'BS FASHION', vendorLocation: 'KOLKATA', vendorId: 'v4',
    orderQty: 480, targetPrice: 310, costStatus: 'submitted',
    parentId: 'NNKNTW250040', splitSeq: 1,
    submittedCost: 298,
    breakdown: { mainFabricPrice: 92, mainFabricConsumption: 1.3, trimFabricPrice: 20, trimFabricConsumption: 0.3, trimCostThread: 38, cmp: 78, valueAddition: 24, testing: 10, logistic: 8, rejectionPct: 2, marginPct: 3 },
    submittedOn: '2026-05-02',
    buyingExpectedDate: '2026-07-10', vendorTargetDate: '2026-06-25',
    season: 'AW26',
    notes: 'Co-loading with existing Kolkata order, CMT reduced.',
  },
  // Split child 2
  {
    id: 'NNKNTW250040-B', styleCode: 'NN440-180', styleName: 'Girls Printed Midi Dress',
    colour: 'TEAL PRINT', category: 'Knits', vendor: 'SWARA CREATION', vendorLocation: 'MUMBAI', vendorId: 'v10',
    orderQty: 320, targetPrice: 310, costStatus: 'pending',
    parentId: 'NNKNTW250040', splitSeq: 2,
    buyingExpectedDate: '2026-07-10', vendorTargetDate: '2026-06-25',
    season: 'AW26',
  },
]

const INITIAL_RFQS: RFQRecord[] = [
  {
    id: 'RFQ-NNKNTW250011-v3',
    orderId: 'NNKNTW250011', styleCode: 'NN412-089', styleName: 'Boys Cargo Jogger',
    colour: 'OLIVE', category: 'Wovens', orderQty: 450, targetPrice: 320,
    vendorId: 'v3', vendorName: 'IDS FASHION', vendorLocation: 'NOIDA',
    sentDate: '2026-05-10', dueDate: '2026-05-17',
    status: 'overdue',
  },
  {
    id: 'RFQ-NNKNTW250012-v4',
    orderId: 'NNKNTW250012', styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', category: 'Knits', orderQty: 720, targetPrice: 340,
    vendorId: 'v4', vendorName: 'BS FASHION', vendorLocation: 'KOLKATA',
    sentDate: '2026-04-22', dueDate: '2026-04-29',
    status: 'responded', responseDate: '2026-04-27',
    submittedCost: 326,
    breakdown: { mainFabricPrice: 95, mainFabricConsumption: 1.4, trimFabricPrice: 24, trimFabricConsumption: 0.35, trimCostThread: 40, cmp: 82, valueAddition: 28, testing: 12, logistic: 8, rejectionPct: 2, marginPct: 3 },
    notes: 'Able to reduce CMT by 4% by co-loading with another order. Fabric sourced at prev. season price.',
  },
  {
    id: 'RFQ-NNKNTW250013-v5',
    orderId: 'NNKNTW250013', styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', category: 'Wovens', orderQty: 380, targetPrice: 295,
    vendorId: 'v5', vendorName: 'DIV CREATIONS', vendorLocation: 'FARIDABAD',
    sentDate: '2026-04-20', dueDate: '2026-04-27',
    status: 'responded', responseDate: '2026-04-26',
    submittedCost: 310,
    breakdown: { mainFabricPrice: 108, mainFabricConsumption: 1.2, trimFabricPrice: 20, trimFabricConsumption: 0.3, trimCostThread: 36, cmp: 84, valueAddition: 0, testing: 10, logistic: 8, rejectionPct: 2, marginPct: 12 },
    notes: 'Linen blend yarn cost up 6% vs last season. Vendor proposes using 55/45 blend vs 60/40 to meet target — seeking POC direction.',
  },
  {
    id: 'RFQ-NNKNTW250015-v8',
    orderId: 'NNKNTW250015', styleCode: 'NN415-078', styleName: 'Boys French Terry Sweatshirt',
    colour: 'NAVY MELANGE', category: 'Knits', orderQty: 550, targetPrice: 380,
    vendorId: 'v8', vendorName: 'CAARVI TEXTILES', vendorLocation: 'DELHI',
    sentDate: '2026-04-19', dueDate: '2026-04-26',
    status: 'responded', responseDate: '2026-04-24',
    submittedCost: 434,
    breakdown: { mainFabricPrice: 130, mainFabricConsumption: 1.5, trimFabricPrice: 22, trimFabricConsumption: 0.4, trimCostThread: 44, cmp: 94, valueAddition: 42, testing: 12, logistic: 8, rejectionPct: 2, marginPct: 6 },
    notes: 'French terry yarn prices elevated due to cotton futures spike. Vendor has confirmed no scope for reduction without quality compromise.',
  },
  {
    id: 'RFQ-NNKNTW250016-v2',
    orderId: 'NNKNTW250016', styleCode: 'NN408-245', styleName: 'Girls Embroidered Sharara Set',
    colour: 'MAROON', category: 'Wovens', orderQty: 280, targetPrice: 520,
    vendorId: 'v2', vendorName: 'ARIHANT FASHIONS', vendorLocation: 'KOLKATA',
    sentDate: '2026-04-13', dueDate: '2026-04-20',
    status: 'responded', responseDate: '2026-04-18',
    submittedCost: 498,
    breakdown: { mainFabricPrice: 138, mainFabricConsumption: 1.5, trimFabricPrice: 26, trimFabricConsumption: 0.5, trimCostThread: 58, cmp: 116, valueAddition: 50, testing: 12, logistic: 8, rejectionPct: 2, marginPct: 5.5 },
    notes: 'Zari work cost elevated. Approved — within acceptable 4.2% under target range.',
  },
  {
    id: 'RFQ-NNKNTW250017-v9',
    orderId: 'NNKNTW250017', styleCode: 'NN411-312', styleName: 'Boys Printed Bermuda Shorts',
    colour: 'COBALT', category: 'Wovens', orderQty: 650, targetPrice: 198,
    vendorId: 'v9', vendorName: 'PESOS VISION', vendorLocation: 'MUMBAI',
    sentDate: '2026-04-05', dueDate: '2026-04-12',
    status: 'responded', responseDate: '2026-04-10',
    submittedCost: 192,
    breakdown: { mainFabricPrice: 58, mainFabricConsumption: 1.2, trimFabricPrice: 16, trimFabricConsumption: 0.3, trimCostThread: 24, cmp: 58, valueAddition: 18, testing: 6, logistic: 4, rejectionPct: 2, marginPct: 2 },
  },
  {
    id: 'RFQ-NNKNTW250014-v6',
    orderId: 'NNKNTW250014', styleCode: 'NN401-190', styleName: 'Girls Printed Balloon Dress',
    colour: 'CORAL', category: 'Knits', orderQty: 900, targetPrice: 245,
    vendorId: 'v6', vendorName: 'AND DESIGN', vendorLocation: 'JAIPUR',
    sentDate: '2026-04-08', dueDate: '2026-04-15',
    status: 'responded', responseDate: '2026-04-14',
    submittedCost: 238,
    breakdown: { mainFabricPrice: 72, mainFabricConsumption: 1.2, trimFabricPrice: 18, trimFabricConsumption: 0.4, trimCostThread: 28, cmp: 72, valueAddition: 22, testing: 8, logistic: 6, rejectionPct: 2, marginPct: 2 },
  },
  {
    id: 'RFQ-NNKNTW250018-v7',
    orderId: 'NNKNTW250018', styleCode: 'NN422-190', styleName: 'Girls Velvet Pinafore',
    colour: 'BURGUNDY', category: 'Wovens', orderQty: 300, targetPrice: 480,
    vendorId: 'v7', vendorName: 'ADITEE INTERNATIONAL', vendorLocation: 'JAIPUR',
    sentDate: '2026-04-17', dueDate: '2026-04-24',
    status: 'responded', responseDate: '2026-04-22',
    submittedCost: 545,
    breakdown: { mainFabricPrice: 158, mainFabricConsumption: 1.5, trimFabricPrice: 25, trimFabricConsumption: 0.5, trimCostThread: 68, cmp: 116, valueAddition: 44, testing: 14, logistic: 12, rejectionPct: 2, marginPct: 7 },
    notes: 'Italian-origin velvet substitute proposed at ₹498 — category head reviewing quality sample before sign-off.',
  },
  {
    id: 'RFQ-NNKNTW250019-v9',
    orderId: 'NNKNTW250019', styleCode: 'NN418-067', styleName: 'Boys Printed Co-ord Set',
    colour: 'MULTI', category: 'Knits', orderQty: 480, targetPrice: 355,
    vendorId: 'v9', vendorName: 'PESOS VISION', vendorLocation: 'MUMBAI',
    sentDate: '2026-04-14', dueDate: '2026-04-21',
    status: 'responded', responseDate: '2026-04-17',
  },
  {
    id: 'RFQ-NNKNTW250032-v1',
    orderId: 'NNKNTW250032', styleCode: 'NN432-205', styleName: 'Girls Palazzo Set',
    colour: 'LAVENDER', category: 'Wovens', orderQty: 350, targetPrice: 420,
    vendorId: 'v1', vendorName: 'BHARTI APPARELS', vendorLocation: 'FARIDABAD',
    sentDate: '2026-04-14', dueDate: '2026-04-21',
    status: 'responded', responseDate: '2026-04-18',
    submittedCost: 398,
    breakdown: {
      mainFabricPrice: 115, mainFabricConsumption: 1.5,
      trimFabricPrice: 22, trimFabricConsumption: 0.4,
      trimCostThread: 52, cmp: 96, valueAddition: 38,
      testing: 12, logistic: 8, rejectionPct: 2, marginPct: 2.5,
    },
    notes: 'Fabric cost elevated due to yarn dyed woven; CMT competitive.',
  },
  {
    id: 'RFQ-NNKNTW250035-v1',
    orderId: 'NNKNTW250035', styleCode: 'NN435-310', styleName: 'Girls Tiered Skirt',
    colour: 'PEACH', category: 'Wovens', orderQty: 480, targetPrice: 295,
    vendorId: 'v1', vendorName: 'BHARTI APPARELS', vendorLocation: 'FARIDABAD',
    sentDate: '2026-04-18', dueDate: '2026-04-25',
    status: 'responded', responseDate: '2026-04-22',
    submittedCost: 342,
    breakdown: {
      mainFabricPrice: 98, mainFabricConsumption: 1.4,
      trimFabricPrice: 18, trimFabricConsumption: 0.5,
      trimCostThread: 42, cmp: 88, valueAddition: 20,
      testing: 12, logistic: 14, rejectionPct: 3, marginPct: 5,
    },
    notes: 'Fabric sourced from premium mill.',
  },
  {
    id: 'RFQ-NNKNTW250036-v1',
    orderId: 'NNKNTW250036', styleCode: 'NN436-088', styleName: 'Boys Oxford Shirt',
    colour: 'WHITE', category: 'Wovens', orderQty: 720, targetPrice: 260,
    vendorId: 'v1', vendorName: 'BHARTI APPARELS', vendorLocation: 'FARIDABAD',
    sentDate: '2026-04-04', dueDate: '2026-04-11',
    status: 'responded', responseDate: '2026-04-07',
    submittedCost: 248,
    breakdown: {
      mainFabricPrice: 88, mainFabricConsumption: 1.3,
      trimFabricPrice: 14, trimFabricConsumption: 0.35,
      trimCostThread: 34, cmp: 72, valueAddition: 0,
      testing: 8, logistic: 6, rejectionPct: 2, marginPct: 2,
    },
  },
  // ── Multi-vendor quote scenarios ──────────────────────────────────────────────
  // Second quote for NNKNTW250012 (Girls Smocked Kurta Set, 720 pcs, target ₹340)
  {
    id: 'RFQ-NNKNTW250012-v10',
    orderId: 'NNKNTW250012', styleCode: 'NN409-155', styleName: 'Girls Smocked Kurta Set',
    colour: 'YELLOW', category: 'Knits', orderQty: 720, targetPrice: 340,
    vendorId: 'v10', vendorName: 'SWARA CREATION', vendorLocation: 'SURAT',
    sentDate: '2026-04-22', dueDate: '2026-04-29',
    status: 'responded', responseDate: '2026-04-28',
    submittedCost: 312,
    breakdown: { mainFabricPrice: 90, mainFabricConsumption: 1.4, trimFabricPrice: 20, trimFabricConsumption: 0.35, trimCostThread: 36, cmp: 76, valueAddition: 24, testing: 10, logistic: 8, rejectionPct: 2, marginPct: 3 },
    notes: 'Surat-based factory specialises in smocked garments — competitive CMT and on-time delivery assured.',
  },
  // Second quote for NNKNTW250013 (Boys Linen Blend Shirt, 380 pcs, target ₹295)
  {
    id: 'RFQ-NNKNTW250013-v2',
    orderId: 'NNKNTW250013', styleCode: 'NN403-302', styleName: 'Boys Linen Blend Shirt',
    colour: 'SKY BLUE', category: 'Wovens', orderQty: 380, targetPrice: 295,
    vendorId: 'v2', vendorName: 'ARIHANT FASHIONS', vendorLocation: 'KOLKATA',
    sentDate: '2026-04-20', dueDate: '2026-04-27',
    status: 'responded', responseDate: '2026-04-25',
    submittedCost: 285,
    breakdown: { mainFabricPrice: 100, mainFabricConsumption: 1.2, trimFabricPrice: 18, trimFabricConsumption: 0.3, trimCostThread: 32, cmp: 72, valueAddition: 0, testing: 9, logistic: 7, rejectionPct: 1.5, marginPct: 9 },
    notes: 'Alternative linen mill sourcing at lower cost. Quality confirmed via pre-production sample.',
  },
]

// ─── Context ──────────────────────────────────────────────────────────────────

type CostingStoreValue = {
  orders: CostingOrder[]
  rfqs: RFQRecord[]
  updateOrder: (id: string, patch: Partial<CostingOrder>) => void
  addOrders: (newOrders: CostingOrder[]) => void
  removeOrders: (ids: string[]) => void
  sendRFQ: (orderId: string, vendorId: string, vendorName: string, vendorLocation: string, qty: number, dueDate: string, notes?: string) => void
  updateRFQ: (id: string, patch: Partial<RFQRecord>) => void
  cancelRFQ: (rfqId: string) => void
  followUpRFQ: (rfqId: string) => void
  vendorSubmitRFQ: (rfqId: string, cost: number, breakdown: OpenCostingBreakdown, notes: string, promisedDate: string) => void
  // Buying team (level-2) actions
  buyingApprove: (id: string, by: string, notes?: string) => void
  buyingRequestRevision: (id: string, by: string, feedback: string) => void
  buyingReject: (id: string, by: string, reason: string) => void
}

const CostingStoreContext = createContext<CostingStoreValue | null>(null)

export function CostingStoreProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<CostingOrder[]>(INITIAL_ORDERS)
  const [rfqs, setRfqs] = useState<RFQRecord[]>(INITIAL_RFQS)

  const updateOrder = (id: string, patch: Partial<CostingOrder>) => {
    setOrders(prev => prev.map(o => o.id !== id ? o : { ...o, ...patch }))
  }

  const addOrders = (newOrders: CostingOrder[]) => {
    setOrders(prev => [...prev, ...newOrders])
  }

  const removeOrders = (ids: string[]) => {
    setOrders(prev => prev.filter(o => !ids.includes(o.id)))
  }

  const sendRFQ = (
    orderId: string,
    vendorId: string,
    vendorName: string,
    vendorLocation: string,
    qty: number,
    dueDate: string,
    notes?: string,
  ) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return
    const today = new Date().toISOString().split('T')[0]
    const newRFQ: RFQRecord = {
      id: `RFQ-${orderId}-${vendorId}`,
      orderId,
      styleCode: order.styleCode,
      styleName: order.styleName,
      colour: order.colour,
      category: order.category,
      orderQty: qty,
      targetPrice: order.targetPrice,
      vendorId,
      vendorName,
      vendorLocation,
      sentDate: today,
      dueDate,
      status: 'sent',
      notes,
    }
    setRfqs(prev => [...prev, newRFQ])
    // Update matching order
    if (order.costStatus === 'no-vendor') {
      updateOrder(orderId, {
        vendorId,
        vendor: vendorName,
        vendorLocation,
        costStatus: 'pending',
      })
    }
  }

  const updateRFQ = (id: string, patch: Partial<RFQRecord>) => {
    setRfqs(prev => prev.map(r => r.id !== id ? r : { ...r, ...patch }))
  }

  const cancelRFQ = (rfqId: string) => {
    updateRFQ(rfqId, { status: 'cancelled' })
  }

  const followUpRFQ = (rfqId: string) => {
    const today = new Date().toISOString().split('T')[0]
    updateRFQ(rfqId, { followedUpAt: today })
  }

  const vendorSubmitRFQ = (
    rfqId: string,
    cost: number,
    breakdown: OpenCostingBreakdown,
    notes: string,
    promisedDate: string,
  ) => {
    const rfq = rfqs.find(r => r.id === rfqId)
    if (!rfq) return
    const today = new Date().toISOString().split('T')[0]
    updateRFQ(rfqId, {
      status: 'responded',
      submittedCost: cost,
      breakdown,
      notes,
      promisedInwardDate: promisedDate || undefined,
      responseDate: today,
    })
    updateOrder(rfq.orderId, {
      costStatus: 'submitted',
      submittedCost: cost,
      breakdown,
      notes,
      submittedOn: today,
    })
  }

  const today = () => new Date().toISOString().split('T')[0]

  const currentRound = (o: CostingOrder) =>
    o.round ?? (o.history?.length ? Math.max(...o.history.map(h => h.round)) : 1)

  // Apply a Buying decision + append it to the style's history in one update.
  const decide = (
    id: string,
    patch: Partial<CostingOrder>,
    event: Omit<CostingEvent, 'round' | 'date'>,
    nextRound?: (round: number) => number,
  ) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const round = currentRound(o)
      return {
        ...o,
        ...patch,
        round: nextRound ? nextRound(round) : round,
        history: [...(o.history ?? []), { ...event, round, date: today() }],
      }
    }))
  }

  const buyingApprove = (id: string, by: string, notes?: string) => {
    const comment = notes?.trim() || undefined
    decide(id,
      { buyingStatus: 'approved', buyingDecisionBy: by, buyingDecisionOn: today(), buyingFeedback: comment },
      { type: 'buying-approved', by, role: 'Buying POC', comment })
  }

  // Send back to Sourcing/vendor for a revised quote — re-opens level-1 review
  // and advances to the next costing round.
  const buyingRequestRevision = (id: string, by: string, feedback: string) => {
    decide(id,
      { buyingStatus: 'revision', buyingDecisionBy: by, buyingDecisionOn: today(), buyingFeedback: feedback, costStatus: 'submitted' },
      { type: 'revision-requested', by, role: 'Buying POC', comment: feedback },
      round => round + 1)
  }

  const buyingReject = (id: string, by: string, reason: string) => {
    decide(id,
      { buyingStatus: 'rejected', buyingDecisionBy: by, buyingDecisionOn: today(), buyingFeedback: reason, costStatus: 'rejected', rejectedReason: reason },
      { type: 'rejected', by, role: 'Buying POC', comment: reason })
  }

  return (
    <CostingStoreContext.Provider value={{
      orders, rfqs,
      updateOrder, addOrders, removeOrders,
      sendRFQ, updateRFQ, cancelRFQ, followUpRFQ, vendorSubmitRFQ,
      buyingApprove, buyingRequestRevision, buyingReject,
    }}>
      {children}
    </CostingStoreContext.Provider>
  )
}

export function useCostingStore() {
  const ctx = useContext(CostingStoreContext)
  if (!ctx) throw new Error('useCostingStore must be used within CostingStoreProvider')
  return ctx
}
