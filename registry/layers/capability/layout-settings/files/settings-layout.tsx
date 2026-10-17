"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { SettingsLayout } from "@tangle-network/agent-app/settings-react"
import { SETTINGS_SECTIONS, SettingsLink, settingsSectionOf } from "./settings-nav"
import { useSettings } from "./settings-api"

export default function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { members } = useSettings()
  const sections = SETTINGS_SECTIONS.map((section) =>
    section.id === "team" ? { ...section, badge: members.length } : section,
  )
  return (
    <SettingsLayout
      title="Settings"
      description="{{projectName}}"
      sections={sections}
      activeId={settingsSectionOf(pathname)}
      LinkComponent={SettingsLink}
    >
      {children}
    </SettingsLayout>
  )
}
