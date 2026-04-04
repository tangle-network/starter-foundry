import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Trash2, Download, Building2, User, Package, Calendar, MapPin } from 'lucide-react'

interface EntityCardProps {
  type: string
  name: string
  data: Record<string, string>
  source: string
  sourceUrl: string
  scrapedAt: string
  onViewSource: () => void
  onExport: () => void
  onDelete: () => void
}

const typeIcons: Record<string, typeof User> = {
  person: User,
  company: Building2,
  product: Package,
  event: Calendar,
  location: MapPin,
}

const typeBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  person: 'default',
  company: 'secondary',
  product: 'outline',
  event: 'default',
  location: 'secondary',
}

export function EntityCard({
  type,
  name,
  data,
  source,
  sourceUrl,
  scrapedAt,
  onViewSource,
  onExport,
  onDelete,
}: EntityCardProps) {
  const Icon = typeIcons[type] || Package

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">{name}</h3>
            <Badge variant={typeBadgeVariant[type] || 'outline'} className="mt-1 text-xs capitalize">
              {type}
            </Badge>
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{scrapedAt}</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium capitalize text-muted-foreground">{key}</span>
              <span className="truncate text-sm">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {source}
          </a>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onViewSource}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExport}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
