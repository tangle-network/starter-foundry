import { createHmac, timingSafeEqual } from 'crypto'

// Types

interface PRUser {
  login: string
  id: number
}

interface PullRequest {
  number: number
  title: string
  body: string | null
  state: string
  user: PRUser
  changed_files: number
  additions: number
  deletions: number
  head: { ref: string; sha: string }
  base: { ref: string; sha: string }
}

interface Issue {
  number: number
  title: string
  body: string | null
  state: string
  user: PRUser
  labels: Array<{ name: string }>
  assignees: Array<{ login: string }>
}

interface PREvent {
  action: string
  pull_request: PullRequest
  repository: { full_name: string }
}

interface IssueEvent {
  action: string
  issue: Issue
  repository: { full_name: string }
}

interface PRMetadata {
  number: number
  title: string
  author: string
  baseBranch: string
  headBranch: string
  headSha: string
  additions: number
  deletions: number
  changedFiles: number
  action: string
}

interface IssueMetadata {
  number: number
  title: string
  body: string | null
  author: string
  labels: string[]
  assignees: string[]
  state: string
  action: string
}

interface AgentPrompt {
  role: string
  repo: string
  eventType: 'pull_request' | 'issue'
  summary: string
  detail: string
}

// Implementation

export function handlePREvent(event: PREvent): PRMetadata {
  const { pull_request: pr, action } = event
  return {
    number: pr.number,
    title: pr.title,
    author: pr.user.login,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    headSha: pr.head.sha,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    action,
  }
}

export function handleIssueEvent(event: IssueEvent): IssueMetadata {
  const { issue, action } = event
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    author: issue.user.login,
    labels: issue.labels.map((l) => l.name),
    assignees: issue.assignees.map((a) => a.login),
    state: issue.state,
    action,
  }
}

export function formatForAgent(event: PREvent | IssueEvent): AgentPrompt {
  const repo = event.repository.full_name

  if ('pull_request' in event) {
    const meta = handlePREvent(event)
    return {
      role: 'You are a code review assistant.',
      repo,
      eventType: 'pull_request',
      summary: `PR #${meta.number}: "${meta.title}" by ${meta.author} (${meta.action})`,
      detail: [
        `Branch: ${meta.headBranch} -> ${meta.baseBranch}`,
        `Changes: +${meta.additions} -${meta.deletions} across ${meta.changedFiles} file(s)`,
        `Head SHA: ${meta.headSha}`,
      ].join('\n'),
    }
  }

  const meta = handleIssueEvent(event as IssueEvent)
  return {
    role: 'You are an issue triage assistant.',
    repo,
    eventType: 'issue',
    summary: `Issue #${meta.number}: "${meta.title}" by ${meta.author} (${meta.action})`,
    detail: [
      `Labels: ${meta.labels.length > 0 ? meta.labels.join(', ') : 'none'}`,
      `Assignees: ${meta.assignees.length > 0 ? meta.assignees.join(', ') : 'unassigned'}`,
      meta.body ? `Body:\n${meta.body.slice(0, 2000)}` : 'No body provided.',
    ].join('\n'),
  }
}

export function verifyWebhook(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = Buffer.from(
    'sha256=' + createHmac('sha256', secret).update(payload).digest('hex'),
    'utf8',
  )
  const actual = Buffer.from(signatureHeader, 'utf8')
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
