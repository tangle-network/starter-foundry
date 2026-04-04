import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'

type Role = 'owner' | 'admin' | 'member' | 'viewer'

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
}

export function canManageMembers(role: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin
}

export function canInvite(role: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin
}

export function canDelete(role: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.owner
}

export function createTeamsRouter() {
  async function createTeam(req: Request, res: Response) {
    const { name, slug } = req.body
    const user = (req as any).user
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'slug must be lowercase alphanumeric with dashes' })
    }
    const team = {
      id: randomUUID(),
      name,
      slug,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    }
    // Persist team and add creator as owner
    res.status(201).json(team)
  }

  async function listMembers(req: Request, res: Response) {
    const { id } = req.params
    // Fetch members from your data store by team id
    void id
    res.json({ members: [] })
  }

  async function invite(req: Request, res: Response) {
    const { id } = req.params
    const { email, role } = req.body
    const actorRole = (req as any).teamRole as Role

    if (!canInvite(actorRole)) {
      return res.status(403).json({ error: 'insufficient permissions to invite members' })
    }
    if (!email || !role) return res.status(400).json({ error: 'email and role required' })
    if (ROLE_HIERARCHY[role as Role] === undefined) {
      return res.status(400).json({ error: 'invalid role' })
    }
    if (ROLE_HIERARCHY[role as Role] >= ROLE_HIERARCHY[actorRole]) {
      return res.status(403).json({ error: 'cannot invite with role equal to or above your own' })
    }

    const invitation = {
      id: randomUUID(),
      teamId: id,
      email,
      role,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    }
    // Persist invitation, send email with signed join link
    res.status(201).json(invitation)
  }

  async function updateMemberRole(req: Request, res: Response) {
    const { id, userId } = req.params
    const { role: newRole } = req.body
    const actorRole = (req as any).teamRole as Role

    if (!canManageMembers(actorRole)) {
      return res.status(403).json({ error: 'insufficient permissions to manage members' })
    }
    if (ROLE_HIERARCHY[newRole as Role] === undefined) {
      return res.status(400).json({ error: 'invalid role' })
    }
    if (ROLE_HIERARCHY[newRole as Role] >= ROLE_HIERARCHY[actorRole]) {
      return res.status(403).json({ error: 'cannot assign role equal to or above your own' })
    }

    // Update member role in data store
    void id
    res.json({ userId, role: newRole })
  }

  async function removeMember(req: Request, res: Response) {
    const { id, userId } = req.params
    const actorRole = (req as any).teamRole as Role
    const actorId = (req as any).user.id

    if (userId === actorId) {
      return res.status(400).json({ error: 'cannot remove yourself, transfer ownership first' })
    }
    if (!canManageMembers(actorRole)) {
      return res.status(403).json({ error: 'insufficient permissions to remove members' })
    }

    // Remove member from data store
    void id
    res.status(204).end()
  }

  return { createTeam, listMembers, invite, updateMemberRole, removeMember }
}
