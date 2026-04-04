// Types

export interface Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
  additions: string[]
  deletions: string[]
}

export interface DiffFile {
  path: string
  oldPath?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: Hunk[]
  additions: number
  deletions: number
}

export type ReviewCategory = 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'config' | 'unknown'

interface CategorizedChanges {
  categories: Map<ReviewCategory, DiffFile[]>
  primary: ReviewCategory
  summary: string
}

// Implementation

export function parseDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = []
  const fileSections = diffText.split(/^diff --git /m).filter(Boolean)

  for (const section of fileSections) {
    const lines = section.split('\n')

    // Extract file paths from the header line: a/path b/path
    const headerMatch = lines[0]?.match(/a\/(.+?)\s+b\/(.+)/)
    if (!headerMatch) continue

    const oldPath = headerMatch[1]
    const newPath = headerMatch[2]

    // Determine status
    let status: DiffFile['status'] = 'modified'
    if (section.includes('new file mode')) status = 'added'
    else if (section.includes('deleted file mode')) status = 'deleted'
    else if (oldPath !== newPath) status = 'renamed'

    // Parse hunks
    const hunks: Hunk[] = []
    const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/
    let currentHunk: Hunk | null = null

    for (const line of lines) {
      const hunkMatch = line.match(hunkRegex)
      if (hunkMatch) {
        if (currentHunk) hunks.push(currentHunk)
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: parseInt(hunkMatch[2] ?? '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newLines: parseInt(hunkMatch[4] ?? '1', 10),
          content: hunkMatch[5]?.trim() ?? '',
          additions: [],
          deletions: [],
        }
        continue
      }

      if (!currentHunk) continue

      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.additions.push(line.slice(1))
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.deletions.push(line.slice(1))
      }
    }

    if (currentHunk) hunks.push(currentHunk)

    const additions = hunks.reduce((s, h) => s + h.additions.length, 0)
    const deletions = hunks.reduce((s, h) => s + h.deletions.length, 0)

    files.push({
      path: newPath,
      ...(status === 'renamed' ? { oldPath } : {}),
      status,
      hunks,
      additions,
      deletions,
    })
  }

  return files
}

export function categorizeChanges(files: DiffFile[]): CategorizedChanges {
  const categories = new Map<ReviewCategory, DiffFile[]>()

  const testPatterns = [/\.test\./, /\.spec\./, /__tests__/, /\.e2e\./]
  const docPatterns = [/\.md$/, /docs\//, /README/, /CHANGELOG/, /LICENSE/]
  const configPatterns = [/\.json$/, /\.ya?ml$/, /\.toml$/, /\.env/, /Dockerfile/, /\.config\./]
  const bugfixIndicators = ['fix', 'patch', 'hotfix', 'bug', 'error', 'issue']

  for (const file of files) {
    let category: ReviewCategory = 'unknown'
    const lower = file.path.toLowerCase()

    if (testPatterns.some((p) => p.test(file.path))) {
      category = 'test'
    } else if (docPatterns.some((p) => p.test(file.path))) {
      category = 'docs'
    } else if (configPatterns.some((p) => p.test(lower))) {
      category = 'config'
    } else {
      // Analyze diff content for bugfix vs feature vs refactor
      const allAdditions = file.hunks.flatMap((h) => h.additions).join(' ').toLowerCase()
      const isBugfix = bugfixIndicators.some((w) => allAdditions.includes(w))

      if (isBugfix) {
        category = 'bugfix'
      } else if (file.status === 'added') {
        category = 'feature'
      } else if (file.additions > 0 && file.deletions > 0 && Math.abs(file.additions - file.deletions) < file.additions * 0.3) {
        // Similar number of additions and deletions suggests refactoring
        category = 'refactor'
      } else {
        category = 'feature'
      }
    }

    const existing = categories.get(category) ?? []
    existing.push(file)
    categories.set(category, existing)
  }

  // Determine primary category by file count
  let primary: ReviewCategory = 'unknown'
  let maxCount = 0
  for (const [cat, catFiles] of categories) {
    if (catFiles.length > maxCount) {
      maxCount = catFiles.length
      primary = cat
    }
  }

  const parts: string[] = []
  for (const [cat, catFiles] of categories) {
    parts.push(`${cat}: ${catFiles.length} file(s)`)
  }

  return { categories, primary, summary: parts.join(', ') }
}

export function buildReviewPrompt(diff: DiffFile[], context?: string): string {
  const categorized = categorizeChanges(diff)
  const totalAdditions = diff.reduce((s, f) => s + f.additions, 0)
  const totalDeletions = diff.reduce((s, f) => s + f.deletions, 0)

  const sections: string[] = [
    '# Code Review Request',
    '',
    `**Change type:** ${categorized.primary}`,
    `**Scope:** ${diff.length} file(s), +${totalAdditions} -${totalDeletions}`,
    `**Breakdown:** ${categorized.summary}`,
  ]

  if (context) {
    sections.push('', '## Context', context)
  }

  sections.push('', '## Changed Files')

  for (const file of diff) {
    sections.push(``, `### ${file.path} (${file.status}, +${file.additions} -${file.deletions})`)
    for (const hunk of file.hunks) {
      if (hunk.content) sections.push(`\`${hunk.content}\``)
      if (hunk.deletions.length > 0) {
        sections.push('```diff')
        for (const line of hunk.deletions) sections.push(`- ${line}`)
        sections.push('```')
      }
      if (hunk.additions.length > 0) {
        sections.push('```diff')
        for (const line of hunk.additions) sections.push(`+ ${line}`)
        sections.push('```')
      }
    }
  }

  sections.push(
    '',
    '## Review Checklist',
    '- [ ] Logic correctness',
    '- [ ] Error handling',
    '- [ ] Security implications',
    '- [ ] Performance considerations',
    '- [ ] Test coverage',
  )

  return sections.join('\n')
}
