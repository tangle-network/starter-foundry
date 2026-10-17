import { useSyncExternalStore } from "react"
import type { InvitationView, MemberView } from "@tangle-network/agent-app/teams-react"
import { confirmWrite, rejectWrite, type MutationOutcome } from "@tangle-network/agent-app/web-react/async"

/**
 * What the settings pages read and write. It is kept in memory, so a new app's
 * settings work before the app has a backend. Replace each write with a call to
 * your API that resolves with the value the server kept, for example
 *
 *   saveName: (name) =>
 *     confirmSettingResponse(fetch("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) }), () => name)
 *
 * (`confirmSettingResponse` is in `@tangle-network/agent-app/settings-react`). A
 * route that refuses answers `{ error: { code, message } }`, and the row shows
 * its message. Rows say "Saved" only after a write is confirmed.
 */

export type PlanId = "free" | "pro" | "team"
export type WorkspaceRole = MemberView["role"]

export interface Plan {
  id: PlanId
  name: string
  monthlyUsd: number
  seats: number
}

export const PLANS: Plan[] = [
  { id: "free", name: "Free", monthlyUsd: 0, seats: 3 },
  { id: "pro", name: "Pro", monthlyUsd: 29, seats: 5 },
  { id: "team", name: "Team", monthlyUsd: 79, seats: 20 },
]

export interface Profile {
  name: string
  email: string
  photoUrl: string | null
}

export type NotificationId = "activity" | "security" | "product"

export interface Subscription {
  plan: PlanId
  /** The next renewal, as YYYY-MM-DD. */
  renewsOn: string
  /** True after cancellation: the plan ends on `renewsOn` and is not renewed. */
  canceled: boolean
}

export interface SettingsData {
  profile: Profile
  notifications: Record<NotificationId, boolean>
  subscription: Subscription
  members: MemberView[]
  invitations: InvitationView[]
}

/** The signed-in person. Read it from your auth session. */
export const CURRENT_USER_ID = "user-owner"

const JOINED = Date.UTC(2026, 0, 12)

function nextRenewal(today = new Date()): string {
  const month = today.getUTCMonth() + (today.getUTCDate() >= 15 ? 1 : 0)
  return new Date(Date.UTC(today.getUTCFullYear(), month, 15)).toISOString().slice(0, 10)
}

let data: SettingsData = {
  profile: { name: "John Doe", email: "john@example.com", photoUrl: null },
  notifications: { activity: true, security: true, product: true },
  subscription: { plan: "pro", renewsOn: nextRenewal(), canceled: false },
  members: [
    { id: "member-owner", userId: CURRENT_USER_ID, role: "owner", name: "John Doe", email: "john@example.com", acceptedAt: JOINED },
    { id: "member-sarah", userId: "user-sarah", role: "admin", name: "Sarah Chen", email: "sarah@example.com", acceptedAt: JOINED },
    { id: "member-marcus", userId: "user-marcus", role: "editor", name: "Marcus Johnson", email: "marcus@example.com", acceptedAt: JOINED },
  ],
  invitations: [],
}

const listeners = new Set<() => void>()

function update(next: Partial<SettingsData>) {
  data = { ...data, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The current settings; a confirmed write re-renders every reader. */
export function useSettings(): SettingsData {
  return useSyncExternalStore(subscribe, () => data, () => data)
}

export function planOf(id: PlanId): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0]
}

export function formatPrice(plan: Plan): string {
  return `$${plan.monthlyUsd} a month`
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  )
}

export function seatsInUse(settings: SettingsData): number {
  return settings.members.length + settings.invitations.filter((invitation) => invitation.status === "pending").length
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailProblem(value: string): string | null {
  return EMAIL.test(value.trim()) ? null : "Enter an email address, such as name@company.com."
}

function refuse(code: string, message: string): MutationOutcome<never> {
  return rejectWrite(message, { code, message })
}

function withOwnerRow(profile: Partial<Profile>): MemberView[] {
  return data.members.map((member) =>
    member.userId === CURRENT_USER_ID
      ? { ...member, ...(profile.name ? { name: profile.name } : {}), ...(profile.email ? { email: profile.email } : {}) }
      : member,
  )
}

export async function saveName(next: string): Promise<MutationOutcome<string>> {
  const name = next.trim()
  if (!name) return refuse("invalid", "Enter your name.")
  update({ profile: { ...data.profile, name }, members: withOwnerRow({ name }) })
  return confirmWrite(name)
}

/** Takes the chosen image's object URL. Upload `await (await fetch(url)).blob()` and keep the stored URL. */
export async function savePhoto(url: string | null): Promise<MutationOutcome<string | null>> {
  update({ profile: { ...data.profile, photoUrl: url } })
  return confirmWrite(url)
}

export async function changeEmail(next: string): Promise<MutationOutcome<string>> {
  const email = next.trim()
  const problem = emailProblem(email)
  if (problem) return refuse("invalid", problem)
  update({ profile: { ...data.profile, email }, members: withOwnerRow({ email }) })
  return confirmWrite(email)
}

export async function saveNotification(id: NotificationId, on: boolean): Promise<MutationOutcome<boolean>> {
  update({ notifications: { ...data.notifications, [id]: on } })
  return confirmWrite(on)
}

export async function changePlan(id: PlanId): Promise<MutationOutcome<PlanId>> {
  const plan = planOf(id)
  if (seatsInUse(data) > plan.seats) {
    return refuse(
      "invalid",
      `${plan.name} has ${plan.seats} seats and ${seatsInUse(data)} are in use or invited. Remove people or revoke invitations first.`,
    )
  }
  update({ subscription: { ...data.subscription, plan: id, canceled: false } })
  return confirmWrite(id)
}

export async function setCanceled(canceled: boolean): Promise<MutationOutcome<boolean>> {
  update({ subscription: { ...data.subscription, canceled } })
  return confirmWrite(canceled)
}

export async function changeMemberRole(input: { memberId: string; role: WorkspaceRole }): Promise<MutationOutcome<WorkspaceRole>> {
  const member = data.members.find((candidate) => candidate.id === input.memberId)
  if (!member) return refuse("invalid", "That person is no longer in this workspace.")
  if (member.role === "owner" || input.role === "owner") return refuse("forbidden", "The owner's role can't be changed here.")
  update({ members: data.members.map((candidate) => (candidate.id === member.id ? { ...candidate, role: input.role } : candidate)) })
  return confirmWrite(input.role)
}

export async function removeMember(input: { memberId: string }): Promise<MutationOutcome<string>> {
  const member = data.members.find((candidate) => candidate.id === input.memberId)
  if (!member) return refuse("invalid", "That person is no longer in this workspace.")
  if (member.role === "owner") return refuse("forbidden", "The owner can't be removed.")
  update({ members: data.members.filter((candidate) => candidate.id !== member.id) })
  return confirmWrite(member.id)
}

export async function invite(input: { email: string; role: WorkspaceRole }): Promise<MutationOutcome<InvitationView>> {
  const email = input.email.trim().toLowerCase()
  const problem = emailProblem(email)
  if (problem) return refuse("invalid", problem)
  if (input.role === "owner") return refuse("forbidden", "Invite people as an admin, editor or viewer.")
  if (data.members.some((member) => member.email?.toLowerCase() === email)) return refuse("invalid", `${email} is already in this workspace.`)
  if (data.invitations.some((invitation) => invitation.status === "pending" && invitation.email === email)) {
    return refuse("invalid", `${email} already has an invitation.`)
  }
  const plan = planOf(data.subscription.plan)
  if (seatsInUse(data) >= plan.seats) {
    return refuse("plan_limit", `${plan.name} includes ${plan.seats} seats and all are in use or invited.`)
  }
  const id = `invite-${Date.now().toString(36)}`
  const invitation: InvitationView = {
    id,
    email,
    permissions: input.role,
    status: "pending",
    emailStatus: "sent",
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    acceptedAt: null,
    inviteUrl: new URL(`/invite/${id}`, window.location.origin).href,
  }
  update({ invitations: [invitation, ...data.invitations] })
  return confirmWrite(invitation)
}

export async function resendInvitation(input: { invitationId: string }): Promise<MutationOutcome<string>> {
  const invitation = data.invitations.find((candidate) => candidate.id === input.invitationId)
  if (!invitation || invitation.status !== "pending") return refuse("invalid", "That invitation is no longer pending.")
  update({
    invitations: data.invitations.map((candidate): InvitationView =>
      candidate.id === invitation.id ? { ...candidate, emailStatus: "sent", expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 } : candidate,
    ),
  })
  return confirmWrite(invitation.id)
}

export async function revokeInvitation(input: { invitationId: string }): Promise<MutationOutcome<string>> {
  const invitation = data.invitations.find((candidate) => candidate.id === input.invitationId)
  if (!invitation || invitation.status !== "pending") return refuse("invalid", "That invitation is no longer pending.")
  update({
    invitations: data.invitations.map(
      (candidate): InvitationView => (candidate.id === invitation.id ? { ...candidate, status: "revoked" } : candidate),
    ),
  })
  return confirmWrite(invitation.id)
}
