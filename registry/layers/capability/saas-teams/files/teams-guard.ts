import type { Request, Response, NextFunction } from 'express'

type Role = 'owner' | 'admin' | 'member' | 'viewer'

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
}

export function requireTeamRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const teamRole = (req as any).teamRole as Role | undefined
    if (!teamRole) {
      return res.status(403).json({
        error: 'team_role_required',
        message: 'You must be a member of this team',
      })
    }
    if (ROLE_HIERARCHY[teamRole] < ROLE_HIERARCHY[minRole]) {
      return res.status(403).json({
        error: 'insufficient_role',
        message: `This action requires the ${minRole} role or higher`,
        currentRole: teamRole,
        requiredRole: minRole,
      })
    }
    next()
  }
}

export function requireTeamOwner() {
  return requireTeamRole('owner')
}
