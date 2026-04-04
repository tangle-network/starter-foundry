import {
  BarChart3,
  Home,
  Settings,
  Users,
  FileText,
  Bell,
  HelpCircle,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

export const navConfig: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { title: 'Users', href: '/dashboard/users', icon: Users },
  { title: 'Documents', href: '/dashboard/documents', icon: FileText },
  { title: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: '3' },
  { title: 'Settings', href: '/dashboard/settings', icon: Settings },
  { title: 'Help', href: '/dashboard/help', icon: HelpCircle },
]
