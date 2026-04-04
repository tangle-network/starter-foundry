import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'

interface Review {
  id: string
  rating: number
  comment: string
  reviewer: {
    name: string
    avatar?: string
  }
  verified?: boolean
  createdAt: string
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

export function ReviewCard({ review }: { review: Review }) {
  const initials = review.reviewer.name.slice(0, 2).toUpperCase()
  const date = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={review.reviewer.avatar} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{review.reviewer.name}</span>
          {review.verified && (
            <Badge variant="secondary" className="text-[10px]">Verified Purchase</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <Stars rating={review.rating} />
      <p className="text-sm text-muted-foreground">{review.comment}</p>
    </div>
  )
}
