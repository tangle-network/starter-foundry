"use client"

import { InvitationsSection, MembersSection } from "@tangle-network/agent-app/settings-react"
import { SettingsLink } from "../settings-nav"
import {
  CURRENT_USER_ID,
  changeMemberRole,
  invite,
  planOf,
  removeMember,
  resendInvitation,
  revokeInvitation,
  seatsInUse,
  useSettings,
} from "../settings-api"

export default function TeamSettings() {
  const settings = useSettings()
  const plan = planOf(settings.subscription.plan)
  return (
    <>
      <MembersSection
        description={`${seatsInUse(settings)} of ${plan.seats} seats used`}
        members={settings.members}
        currentRole="owner"
        currentUserId={CURRENT_USER_ID}
        noun="workspace"
        onChangeRole={changeMemberRole}
        onRemove={removeMember}
        onInvite={invite}
        plansHref="/settings/billing"
        LinkComponent={SettingsLink}
      />
      <InvitationsSection
        invitations={settings.invitations}
        currentRole="owner"
        onResend={resendInvitation}
        onRevoke={revokeInvitation}
      />
    </>
  )
}
