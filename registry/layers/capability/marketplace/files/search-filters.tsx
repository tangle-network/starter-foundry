'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Search, X } from 'lucide-react'

export interface SearchFiltersState {
  query: string
  category: string
  minPrice: string
  maxPrice: string
  sort: string
}

const defaultFilters: SearchFiltersState = {
  query: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
}

interface SearchFiltersProps {
  onFilter: (filters: SearchFiltersState) => void
  categories: string[]
  initialFilters?: Partial<SearchFiltersState>
}

export function SearchFilters({ onFilter, categories, initialFilters }: SearchFiltersProps) {
  const [filters, setFilters] = useState<SearchFiltersState>({
    ...defaultFilters,
    ...initialFilters,
  })

  const update = (patch: Partial<SearchFiltersState>) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    onFilter(next)
  }

  const clear = () => {
    setFilters(defaultFilters)
    onFilter(defaultFilters)
  }

  const hasFilters = filters.query || filters.category || filters.minPrice || filters.maxPrice || filters.sort !== 'newest'

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search listings..."
          value={filters.query}
          onChange={(e) => update({ query: e.target.value })}
          className="pl-8"
        />
      </div>
      <Select value={filters.category} onValueChange={(v) => update({ category: v })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="h-8" />
      <Input
        type="number"
        placeholder="Min $"
        value={filters.minPrice}
        onChange={(e) => update({ minPrice: e.target.value })}
        className="w-[100px]"
      />
      <Input
        type="number"
        placeholder="Max $"
        value={filters.maxPrice}
        onChange={(e) => update({ maxPrice: e.target.value })}
        className="w-[100px]"
      />
      <Separator orientation="vertical" className="h-8" />
      <Select value={filters.sort} onValueChange={(v) => update({ sort: v })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="price-low">Price: Low</SelectItem>
          <SelectItem value="price-high">Price: High</SelectItem>
          <SelectItem value="rating">Top Rated</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear}>
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  )
}
