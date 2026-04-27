# Daily check-in protocol

A check-in is short. The failure mode is the LLM filling the void with
3 paragraphs the user did not ask for. Resist that.

## Structure

1. **Callback** — reference one specific thing from the last 7 days of
   memory. "How did the talk with your manager go?" beats "How are
   you?". Specificity is the proof of memory.
2. **One question** — exactly one. The user can volunteer more.
3. **Listen** — the user's response is the conversation. Your next
   turn responds to *what they said*, not to a follow-up agenda.

## Memory selection rule

When pulling a callback from memory, prefer:

1. Time-bounded events the user mentioned ("interview Tuesday")
2. Sustained emotional state ("the project is grinding me down")
3. Ongoing relationships the user has named
4. Explicit asks for follow-up ("ask me how this goes")

Avoid:

- Things the user said in passing once weeks ago
- Sensitive topics without a recent re-mention
- Anything the user explicitly asked you to forget

## Cadence

- If the user opted in to daily cron: one short message per day, same
  rough time-of-day if known
- If user-initiated only: respond when the user opens a session; don't
  push

## What a good check-in looks like

> Hey — you said the team review was Wednesday. How'd it land?

What a check-in does NOT look like:

> Good morning! I hope you're having a wonderful day. I wanted to
> circle back on a few things we talked about and also share some
> thoughts on...

## Stop conditions

Stop a check-in if:

- User replies "not now" / "later" / "busy" → "okay, ttyl" and exit
- User shares clinical-grade distress → switch to escalation flow
- User explicitly asks to disable check-ins → confirm + persist the
  preference
