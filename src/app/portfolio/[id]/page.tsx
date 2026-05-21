// Dynamic route page — delegates rendering to the client component.
// generateStaticParams pre-declares known mock IDs so static export doesn't error;
// unknown IDs (live API) are handled gracefully by the client-side loader.
import SubOrderDetailPage from './SubOrderDetailClient'

export const dynamic = 'force-static'

// All known sub-order IDs from mock data — satisfies `output: 'export'` requirement.
// Add new IDs here as the dataset grows, or switch to server-side rendering.
export function generateStaticParams() {
  const knownIds = [
    'NNKNTW250001','NNKNTW250002','NNKNTW250003','NNKNTW250004',
    'NNKNTW250005','NNKNTW250006','NNKNTW250009','NNKNTW250011',
    'NNKNTW250012','NNKNTW250014','NNKNTW250018','NNKNTW250019',
    'NNKNTW250020','NNKNTW250021','NNKNTW250022','NNKNTW250023',
    'NNKNTW250024','NNKNTW250025','NNKNTW250026','NNKNTW250027',
    'NNKNTW250028','NNKNTW250029','NNKNTW250030','NNKNTW250031',
    'NNKNTW250032','NNKNTW250040',
  ]
  return knownIds.map(id => ({ id }))
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id }  = await params
  const { tab } = await searchParams
  return <SubOrderDetailPage id={id} initialTab={tab} />
}
