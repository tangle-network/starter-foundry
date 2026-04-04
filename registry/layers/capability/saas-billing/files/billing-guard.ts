import type { Request, Response, NextFunction } from 'express'

interface BillingUser {
  id: string
  plan?: string
}

const PLAN_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  team: 2,
}

export function requirePlan(allowedPlans: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as BillingUser | undefined
    const plan = user?.plan ?? 'free'
    if (allowedPlans.includes(plan)) return next()
    const minPlan = allowedPlans.reduce((a, b) =>
      (PLAN_RANK[a] ?? 0) < (PLAN_RANK[b] ?? 0) ? a : b
    )
    res.status(403).json({
      error: 'plan_required',
      message: `This feature requires the ${minPlan} plan or higher`,
      currentPlan: plan,
      requiredPlans: allowedPlans,
      upgradeUrl: '/pricing',
    })
  }
}

export function isPro(user: BillingUser): boolean {
  return (PLAN_RANK[user.plan ?? 'free'] ?? 0) >= PLAN_RANK.pro
}

export function isTeam(user: BillingUser): boolean {
  return (PLAN_RANK[user.plan ?? 'free'] ?? 0) >= PLAN_RANK.team
}
