"use client"

import { useRef, useState, type ChangeEvent } from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Field,
  fieldMessageId,
  Input,
  SettingsRow,
  SettingsSection,
  Switch,
} from "@tangle-network/ui/primitives"
import { ConfirmAction, useSettingField } from "@tangle-network/agent-app/settings-react"
import {
  changeEmail,
  emailProblem,
  saveName,
  saveNotification,
  savePhoto,
  useSettings,
  type NotificationId,
} from "./settings-api"

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const NOTIFICATIONS: { id: NotificationId; label: string }[] = [
  { id: "activity", label: "Account activity" },
  { id: "security", label: "Security alerts" },
  { id: "product", label: "Product updates" },
]

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
  return (letters.slice(0, 2) || "?").toUpperCase()
}

function PhotoRow({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const photo = useSettingField<string | null>({ saved: photoUrl, save: savePhoto })
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) return setFileError("Choose an image file.")
    if (file.size > MAX_PHOTO_BYTES) return setFileError("Choose an image under 5 MB.")
    setFileError(null)
    photo.setDraft(URL.createObjectURL(file))
  }

  return (
    <SettingsRow label="Photo" htmlFor="profile-photo" layout="compact" {...photo.rowProps} error={fileError ?? photo.rowProps.error}>
      <div className="flex items-center gap-3">
        <Avatar>
          {photo.draft ? <AvatarImage src={photo.draft} alt="" /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <Input ref={fileInput} id="profile-photo" type="file" accept="image/*" hidden onChange={choose} />
        <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
          Change photo
        </Button>
      </div>
    </SettingsRow>
  )
}

function NameRow({ name }: { name: string }) {
  const field = useSettingField({
    saved: name,
    commitOn: "blur",
    validate: (value) => (value.trim() ? null : "Enter your name."),
    save: saveName,
  })
  return (
    <SettingsRow label="Full name" htmlFor="profile-name" {...field.rowProps}>
      <Input
        id="profile-name"
        value={field.draft}
        autoComplete="name"
        onChange={(event) => field.setDraft(event.target.value)}
        onBlur={() => field.commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") field.commit()
          if (event.key === "Escape") field.revert()
        }}
      />
    </SettingsRow>
  )
}

function EmailRow({ email }: { email: string }) {
  const [next, setNext] = useState("")
  const [touched, setTouched] = useState(false)
  const value = next.trim()
  const problem = !value
    ? null
    : value.toLowerCase() === email.toLowerCase()
      ? "This is already your email."
      : emailProblem(value)
  const shownProblem = touched || value.includes("@") ? problem : null
  return (
    <SettingsRow label="Email">
      <div className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">{email}</span>
        <ConfirmAction
          trigger={
            <Button type="button" variant="outline">
              Change…
            </Button>
          }
          onOpenChange={(open) => {
            if (open) return
            setNext("")
            setTouched(false)
          }}
          title="Change your email?"
          consequence="You sign in with the new address from now on, and account emails go there."
          confirmLabel="Change email"
          canConfirm={Boolean(value) && !problem}
          onConfirm={() => changeEmail(value)}
        >
          <Field label="New email" htmlFor="profile-new-email" error={shownProblem}>
            <Input
              id="profile-new-email"
              type="email"
              autoComplete="email"
              value={next}
              aria-invalid={Boolean(shownProblem)}
              aria-describedby={shownProblem ? fieldMessageId("profile-new-email") : undefined}
              onChange={(event) => setNext(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </Field>
        </ConfirmAction>
      </div>
    </SettingsRow>
  )
}

function NotificationRow({ id, label, on }: { id: NotificationId; label: string; on: boolean }) {
  const field = useSettingField({ saved: on, save: (next: boolean) => saveNotification(id, next) })
  return (
    <SettingsRow label={label} htmlFor={`notify-${id}`} layout="compact" {...field.rowProps}>
      <Switch id={`notify-${id}`} checked={field.draft} onCheckedChange={field.setDraft} />
    </SettingsRow>
  )
}

export default function ProfileSettings() {
  const { profile, notifications } = useSettings()
  return (
    <>
      <SettingsSection id="profile" title="Profile">
        <PhotoRow name={profile.name} photoUrl={profile.photoUrl} />
        <NameRow name={profile.name} />
        <EmailRow email={profile.email} />
      </SettingsSection>
      <SettingsSection id="notifications" title="Notifications" description={`Emails go to ${profile.email}.`}>
        {NOTIFICATIONS.map((item) => (
          <NotificationRow key={item.id} id={item.id} label={item.label} on={notifications[item.id]} />
        ))}
      </SettingsSection>
    </>
  )
}
