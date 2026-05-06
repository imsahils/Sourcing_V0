/**
 * Adapters — convert flat ApiSubOrder / ApiVendor responses into the richer
 * SubOrder / Vendor UI types that all existing components expect.
 *
 * Nested relations (preProdStages, poNumbers, fiRequests, productionHistory,
 * samples, history) are not yet returned by the list endpoint, so they are
 * initialised as empty arrays and populated later by detail-endpoint calls.
 */

import type { SubOrder, Vendor } from '@/lib/types'
import type { ApiSubOrder } from '@/lib/api/orders'
import type { ApiVendor } from '@/lib/api/vendors'
import type { ApiUser } from '@/lib/api/users'

export function apiVendorToVendor(v: ApiVendor): Vendor {
  return {
    id: v.id,
    name: v.name,
    location: v.location ?? '',
    contactName:  v.contactName  ?? undefined,
    contactPhone: v.contactPhone ?? undefined,
    contactEmail: v.contactEmail ?? undefined,
    tier:         v.tier         ?? undefined,
    otifScore:    v.otifScore    ?? undefined,
    fiPassRate:   v.fiPassRate   ?? undefined,
  }
}

export function apiOrderToSubOrder(
  api: ApiSubOrder,
  vendorMap?: Map<string, ApiVendor>,
  userMap?: Map<string, ApiUser>,
): SubOrder {
  const apiVendor = vendorMap?.get(api.vendorId ?? '')
  const vendor: Vendor = apiVendor
    ? apiVendorToVendor(apiVendor)
    : { id: api.vendorId ?? '', name: 'Unknown Vendor', location: '' }

  // Resolve POC: prefer joined pocName from API, fallback to userMap lookup
  const apiUser = userMap?.get(api.pocId ?? '')
  const pocName = api.pocName ?? apiUser?.name ?? ''
  const pocInitials = api.pocInitials
    ?? apiUser?.initials
    ?? pocName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

  return {
    id:            api.id,
    styleCode:     api.styleCode,
    styleName:     api.styleName,
    colour:        api.colour,
    category:      api.category,
    product:       api.product       ?? '',
    season:        api.season        ?? '',
    orderType:     (api.orderType    as SubOrder['orderType'])  ?? 'NEW',
    tier:          (api.tier         as SubOrder['tier'])       ?? 'TIER-1',
    gender:        api.gender        ?? '',
    ageGroup:      api.ageGroup      ?? '',
    fabricQuality: api.fabricQuality ?? '',
    vendor,
    poc: {
      id:       api.pocId ?? '',
      name:     pocName,
      initials: pocInitials,
      role:     'sourcing-poc' as SubOrder['poc']['role'],
      brand:    '',
      email:    apiUser?.email ?? '',
    },
    status:       (api.status       as SubOrder['status'])       ?? 'not-started',
    currentStage: (api.currentStage as SubOrder['currentStage']) ?? 'order-brief',
    atRisk:       api.atRisk,

    // Dates
    handoverDate:                api.handoverDate               ?? '',
    orderToVendorDate:           api.orderToVendorDate          ?? '',
    buyingExpectedInwardDate:    api.buyingExpectedInwardDate    ?? new Date().toISOString().slice(0, 10),
    vendorPromisedDate:          api.vendorPromisedDate         ?? '',
    costingApprovedDate:         api.costingApprovedDate        ?? undefined,

    // Costing
    targetPrice: api.targetPrice ?? 0,
    closedCost:  api.closedCost  ?? undefined,
    costStatus:  (api.costStatus as SubOrder['costStatus']) ?? 'pending',

    // Quantities
    orderQty:      api.orderQty,
    cutQty:        api.cutQty,
    sewingQty:     api.sewingQty,
    packedQty:     api.packedQty,
    fiQty:         api.fiQty,
    dispatchedQty: api.dispatchedQty,
    grnQty:        api.grnQty,

    // Relations — populated by the detail endpoint, empty on list view
    poNumbers:         [],
    preProdStages:     [],
    productionHistory: [],
    fiRequests:        [],
    samples:           [],
    history:           [],
  }
}
