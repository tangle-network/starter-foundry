import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Star, Clock, MapPin } from 'lucide-react'

export interface Listing {
  id: string
  title: string
  description: string
  price: number
  images: string[]
  category: string
  seller: {
    name: string
    avatar?: string
    rating: number
  }
  location?: string
  createdAt: string
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function ListingCard({ listing }: { listing: Listing }) {
  const initials = listing.seller.name.slice(0, 2).toUpperCase()

  return (
    <Card className="group overflow-hidden transition-transform hover:scale-[1.02]">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-muted to-muted/50">
        {listing.images[0] && (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        )}
        <Badge className="absolute right-2 top-2 text-sm font-semibold">
          ${listing.price.toLocaleString()}
        </Badge>
      </div>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {listing.category}
          </Badge>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeAgo(listing.createdAt)}
          </span>
        </div>
        <h3 className="line-clamp-1 font-semibold leading-tight">{listing.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{listing.description}</p>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={listing.seller.avatar} />
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{listing.seller.name}</span>
            <span className="flex items-center gap-0.5 text-xs text-amber-500">
              <Star className="h-3 w-3 fill-current" />
              {listing.seller.rating.toFixed(1)}
            </span>
          </div>
          {listing.location && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {listing.location}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
