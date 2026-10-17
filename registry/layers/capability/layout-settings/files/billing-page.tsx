"use client"

import { useState, type ReactNode } from "react"
import { Button, SegmentedControl, SettingsRow, SettingsSection } from "@tangle-network/ui/primitives"
import { ConfirmAction } from "@tangle-network/agent-app/settings-react"
import {
  PLANS,
  changePlan,
  formatDate,
  formatPrice,
  planOf,
  setCanceled,
  useSettings,
  type Plan,
  type PlanId,
} from "../settings-api"

function Value({ children }: { children: ReactNode }) {
  return <span className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">{children}</span>
}

function ChangePlan({ current, renewsOn }: { current: Plan; renewsOn: string }) {
  const [choice, setChoice] = useState<PlanId>(current.id)
  const next = planOf(choice)
  const changed = next.id !== current.id
  return (
    <ConfirmAction
      trigger={
        <Button type="button" variant="outline">
          Change plan…
        </Button>
      }
      onOpenChange={(open) => {
        if (open) setChoice(current.id)
      }}
      title="Change your plan?"
      consequence={
        !changed
          ? "Choose the plan you want."
          : next.monthlyUsd === 0
            ? `Paid features stop on ${formatDate(renewsOn)}, and you are not charged again.`
            : `From your next payment on ${formatDate(renewsOn)}, you pay ${formatPrice(next)}.`
      }
      changes={
        changed
          ? [
              { label: "Plan", from: `${current.name}, ${formatPrice(current)}`, to: `${next.name}, ${formatPrice(next)}` },
              { label: "Seats", from: String(current.seats), to: String(next.seats) },
            ]
          : undefined
      }
      confirmLabel="Change plan"
      canConfirm={changed}
      onConfirm={() => changePlan(choice)}
    >
      <SegmentedControl
        aria-label="Plan"
        value={choice}
        onValueChange={setChoice}
        options={PLANS.map((plan) => ({ value: plan.id, label: plan.name }))}
      />
    </ConfirmAction>
  )
}

export default function BillingSettings() {
  const { subscription } = useSettings()
  const plan = planOf(subscription.plan)
  const ends = formatDate(subscription.renewsOn)
  const paid = plan.monthlyUsd > 0
  return (
    <>
      <SettingsSection id="plan" title="Plan">
        <SettingsRow label="Current plan">
          <div className="flex min-w-0 items-center gap-3">
            <Value>
              {plan.name}, {formatPrice(plan)}
            </Value>
            <ChangePlan current={plan} renewsOn={subscription.renewsOn} />
          </div>
        </SettingsRow>
        <SettingsRow label="Next payment">
          <Value>
            {paid && !subscription.canceled ? `$${plan.monthlyUsd} on ${ends}` : "None"}
          </Value>
        </SettingsRow>
      </SettingsSection>
      {paid && !subscription.canceled ? (
        <SettingsSection id="subscription" title="Cancel subscription" tone="danger">
          <SettingsRow label={`Stop renewing ${plan.name}`} description={`${plan.name} stays active until ${ends}.`} layout="compact">
            <ConfirmAction
              trigger={
                <Button type="button" variant="destructive-outline">
                  Cancel subscription…
                </Button>
              }
              tone="danger"
              title={`Cancel your ${plan.name} subscription?`}
              consequence={`${plan.name} stays active until ${ends}. After that the workspace moves to Free and you are not charged again.`}
              confirmLabel="Cancel subscription"
              cancelLabel="Keep subscription"
              onConfirm={() => setCanceled(true)}
            />
          </SettingsRow>
        </SettingsSection>
      ) : null}
      {paid && subscription.canceled ? (
        <SettingsSection id="subscription" title="Subscription">
          <SettingsRow label={`Resume ${plan.name}`} description={`${plan.name} ends on ${ends}.`} layout="compact">
            <ConfirmAction
              trigger={
                <Button type="button" variant="outline">
                  Resume…
                </Button>
              }
              title={`Resume ${plan.name}?`}
              consequence={`You pay $${plan.monthlyUsd} on ${ends} and every month after.`}
              confirmLabel="Resume subscription"
              onConfirm={() => setCanceled(false)}
            />
          </SettingsRow>
        </SettingsSection>
      ) : null}
    </>
  )
}
