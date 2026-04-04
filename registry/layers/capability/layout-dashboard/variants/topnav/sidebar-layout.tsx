'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { navConfig } from '@/config/nav'
import { Menu, Moon, Sun, Search, Bell, X } from 'lucide-react'

interface TopnavLayoutProps {
  children: React.ReactNode
}

export function TopnavLayout({ children }: TopnavLayoutProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [dark, setDark] = React.useState(false)

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  React.useEffect(() => {
    if (!mobileOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mobileOpen])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-card">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 lg:px-6">
          {/* Logo */}
          <a href="/dashboard" className="shrink-0 text-lg font-semibold">
            {'{{headline}}'}
          </a>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {navConfig.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'text-muted-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
                {item.badge && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </a>
            ))}
          </nav>

          {/* Spacer for mobile */}
          <div className="flex-1 md:hidden" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1">
                  <Avatar className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                    U
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">User</p>
                  <p className="text-xs text-muted-foreground">user@example.com</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <div className="border-t bg-card md:hidden">
            <nav className="mx-auto max-w-screen-2xl space-y-1 px-4 py-3">
              {navConfig.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'text-muted-foreground'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="mx-auto max-w-screen-2xl">{children}</div>
      </main>
    </div>
  )
}
