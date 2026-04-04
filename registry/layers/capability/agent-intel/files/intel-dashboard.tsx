'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Database, Globe, Activity, CheckCircle, Plus, RefreshCw } from 'lucide-react'

interface Entity {
  id: string
  type: string
  name: string
  source: string
  scrapedAt: string
}

interface ScrapeRun {
  id: string
  sourceUrl: string
  status: 'running' | 'completed' | 'failed'
  entitiesFound: number
  duration: string
}

interface Source {
  id: string
  url: string
}

interface IntelDashboardProps {
  entities: Entity[]
  scrapeRuns: ScrapeRun[]
  sources: Source[]
  onNewScrape: () => void
}

const typeBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  person: 'default',
  company: 'secondary',
  product: 'outline',
  event: 'default',
  location: 'secondary',
}

const statusStyles: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
  running: { variant: 'default', label: 'Running' },
  completed: { variant: 'secondary', label: 'Completed' },
  failed: { variant: 'destructive', label: 'Failed' },
}

const sampleEntities: Entity[] = [
  { id: '1', type: 'company', name: 'Acme Corp', source: 'crunchbase.com', scrapedAt: '2 min ago' },
  { id: '2', type: 'person', name: 'Jane Smith', source: 'linkedin.com', scrapedAt: '5 min ago' },
  { id: '3', type: 'product', name: 'DataSync Pro', source: 'g2.com', scrapedAt: '12 min ago' },
  { id: '4', type: 'company', name: 'NovaTech', source: 'crunchbase.com', scrapedAt: '15 min ago' },
  { id: '5', type: 'event', name: 'SaaStr Annual 2026', source: 'saastr.com', scrapedAt: '20 min ago' },
  { id: '6', type: 'person', name: 'Alex Rivera', source: 'linkedin.com', scrapedAt: '30 min ago' },
  { id: '7', type: 'location', name: 'SF Bay Area HQ', source: 'maps.google.com', scrapedAt: '45 min ago' },
  { id: '8', type: 'product', name: 'CloudWatch AI', source: 'producthunt.com', scrapedAt: '1 hr ago' },
]

const sampleRuns: ScrapeRun[] = [
  { id: 'r1', sourceUrl: 'crunchbase.com/discover', status: 'running', entitiesFound: 14, duration: '2m 30s' },
  { id: 'r2', sourceUrl: 'linkedin.com/search', status: 'completed', entitiesFound: 42, duration: '5m 12s' },
  { id: 'r3', sourceUrl: 'g2.com/categories/crm', status: 'completed', entitiesFound: 28, duration: '3m 45s' },
  { id: 'r4', sourceUrl: 'producthunt.com/topics/ai', status: 'failed', entitiesFound: 0, duration: '0m 8s' },
  { id: 'r5', sourceUrl: 'saastr.com/events', status: 'completed', entitiesFound: 6, duration: '1m 20s' },
]

const kpis = [
  { label: 'Total Entities', value: '1,247', icon: Database },
  { label: 'Active Sources', value: '18', icon: Globe },
  { label: 'Scrapes Today', value: '34', icon: Activity },
  { label: 'Success Rate', value: '94.2%', icon: CheckCircle },
]

function entityTypeCounts(entities: Entity[]) {
  const counts: Record<string, number> = {}
  for (const e of entities) {
    counts[e.type] = (counts[e.type] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

export function IntelDashboard({
  entities = sampleEntities,
  scrapeRuns = sampleRuns,
  sources: _sources,
  onNewScrape,
}: IntelDashboardProps) {
  const typeDist = entityTypeCounts(entities)
  const maxCount = Math.max(...typeDist.map(([, c]) => c), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Dashboard</h1>
          <p className="text-muted-foreground">Scraped entities, source health, and run history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={onNewScrape}>
            <Plus className="mr-2 h-4 w-4" />
            New Scrape
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">{kpi.label}</CardDescription>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Entities</CardTitle>
            <CardDescription>Last 20 extracted entities across all sources</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.slice(0, 20).map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell>
                      <Badge variant={typeBadgeVariant[entity.type] || 'outline'} className="text-xs capitalize">
                        {entity.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell className="text-muted-foreground">{entity.source}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">{entity.scrapedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Scrape Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scrapeRuns.map((run) => {
                  const s = statusStyles[run.status]
                  return (
                    <div key={run.id}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 truncate">
                          <p className="truncate text-sm font-medium">{run.sourceUrl}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{run.entitiesFound} entities</span>
                            <span>{run.duration}</span>
                          </div>
                        </div>
                        <Badge variant={s.variant} className="ml-2 text-xs">
                          {s.label}
                        </Badge>
                      </div>
                      <Separator className="mt-3" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {typeDist.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="w-20 text-sm capitalize text-muted-foreground">{type}</span>
                    <div className="flex-1">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
