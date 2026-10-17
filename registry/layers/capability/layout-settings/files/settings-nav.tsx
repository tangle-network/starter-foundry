"use client"

import Link from "next/link"
import { CreditCard, User, Users } from "lucide-react"
import type { SettingsLinkProps, SettingsNavSection } from "@tangle-network/agent-app/settings-react"

export type SettingsSectionId = "profile" | "billing" | "team"

/** One route per section. Add a section here and as a folder beside billing/ and team/. */
export const SETTINGS_SECTIONS: (SettingsNavSection & { id: SettingsSectionId })[] = [
  { id: "profile", label: "Profile", href: "/settings", icon: User },
  { id: "billing", label: "Billing", href: "/settings/billing", icon: CreditCard },
  { id: "team", label: "Team", href: "/settings/team", icon: Users },
]

export function settingsSectionOf(pathname: string): SettingsSectionId {
  const last = pathname.replace(/\/+$/, "").split("/").pop()
  return SETTINGS_SECTIONS.find((section) => section.id === last)?.id ?? "profile"
}

/** The router's link, so moving between sections keeps the page instead of reloading it. */
export function SettingsLink({ href, children, ...rest }: SettingsLinkProps) {
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  )
}
