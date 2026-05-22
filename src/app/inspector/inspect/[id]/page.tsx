// Dynamic route page — delegates rendering to the client component.
// generateStaticParams pre-declares mock inspection IDs so static export works.
import InspectionFormClient from './InspectionFormClient'
import { demoInspections } from '@/lib/inspection-mock'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return demoInspections.map(r => ({ id: r.id }))
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <InspectionFormClient id={id} />
}
