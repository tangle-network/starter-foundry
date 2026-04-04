'use client'

import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, UserMinus, Shield } from 'lucide-react'

type Role = 'owner' | 'admin' | 'member' | 'viewer'

interface Member {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl?: string
  joinedAt: string
}

interface Invitation {
  id: string
  email: string
  role: Role
  expiresAt: string
}

interface TeamMembersProps {
  teamId: string
  members: Member[]
  invitations: Invitation[]
  currentUserRole: Role
  onRoleChange: (userId: string, role: Role) => void
  onRemove: (userId: string) => void
  onInvite: (email: string, role: Role) => void
  onCancelInvite: (invitationId: string) => void
}

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
}

const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, member: 1, viewer: 0 }

const ROLES: Role[] = ['admin', 'member', 'viewer']

export function TeamMembers({
  teamId, members, invitations, currentUserRole,
  onRoleChange, onRemove, onInvite, onCancelInvite,
}: TeamMembersProps) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const canManage = ROLE_RANK[currentUserRole] >= ROLE_RANK.admin

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    onInvite(inviteEmail.trim(), inviteRole)
    setInviteEmail('')
  }

  function initials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <form onSubmit={handleInvite} className="flex gap-3">
          <Input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="max-w-xs"
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.filter((r) => ROLE_RANK[r] < ROLE_RANK[currentUserRole]).map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit">Send Invite</Button>
        </form>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManage && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.avatarUrl} />
                    <AvatarFallback>{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={ROLE_COLORS[m.role]}>{m.role}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(m.joinedAt).toLocaleDateString()}
              </TableCell>
              {canManage && (
                <TableCell>
                  {m.role !== 'owner' && ROLE_RANK[currentUserRole] > ROLE_RANK[m.role] && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ROLES.filter((r) => r !== m.role && ROLE_RANK[r] < ROLE_RANK[currentUserRole]).map((r) => (
                          <DropdownMenuItem key={r} onClick={() => onRoleChange(m.id, r)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Change to {r}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setRemoveTarget(m)}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Pending Invitations</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={ROLE_COLORS[inv.role]}>{inv.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onCancelInvite(inv.id)}
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove {removeTarget?.name} ({removeTarget?.email}) from this team? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removeTarget) onRemove(removeTarget.id)
                setRemoveTarget(null)
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
