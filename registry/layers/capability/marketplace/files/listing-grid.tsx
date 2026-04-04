import { Skeleton } from '@/components/ui/skeleton'
import { ListingCard, type Listing } from './listing-card'
import { PackageOpen } from 'lucide-react'

interface ListingGridProps {
  listings: Listing[]
  isLoading?: boolean
}

function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border p-0">
      <Skeleton className="aspect-[4/3] w-full rounded-b-none rounded-t-lg" />
      <div className="space-y-2 px-3 pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  )
}

export function ListingGrid({ listings, isLoading }: ListingGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <PackageOpen className="h-12 w-12 stroke-1" />
        <p className="text-lg font-medium">No listings found</p>
        <p className="text-sm">Try adjusting your search or filters.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
