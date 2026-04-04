// Types

interface Ticket {
  id: string
  content: string
  customerName: string
  channel: string
  createdAt: string
}

interface KBArticle {
  id: string
  title: string
  body: string
  tags: string[]
}

interface Classification {
  category: 'billing' | 'technical' | 'account' | 'feature-request' | 'general'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  sentiment: 'positive' | 'neutral' | 'negative'
}

// Keyword maps for rule-based classification

const CATEGORY_KEYWORDS: Record<Classification['category'], string[]> = {
  billing: ['invoice', 'charge', 'refund', 'payment', 'subscription', 'price', 'cost', 'bill', 'credit card', 'plan'],
  technical: ['error', 'bug', 'crash', 'broken', 'not working', '500', 'timeout', 'slow', 'api', 'integration'],
  account: ['password', 'login', 'sign in', 'locked', 'access', 'permission', 'reset', 'email', 'username', '2fa'],
  'feature-request': ['feature', 'wish', 'would be nice', 'suggestion', 'could you add', 'request', 'roadmap'],
  general: [],
}

const URGENCY_WORDS = ['asap', 'urgent', 'immediately', 'emergency', 'critical', 'down', 'outage', 'blocked', 'cannot access', 'production']
const NEGATIVE_WORDS = ['frustrated', 'angry', 'terrible', 'worst', 'unacceptable', 'disappointed', 'ridiculous', 'awful', 'hate']
const POSITIVE_WORDS = ['thanks', 'great', 'love', 'excellent', 'amazing', 'helpful', 'appreciate', 'wonderful']

// Implementation

export function classifyTicket(content: string): Classification {
  const lower = content.toLowerCase()

  // Category: score each category by keyword hits
  let bestCategory: Classification['category'] = 'general'
  let bestScore = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Classification['category'], string[]][]) {
    const score = keywords.reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestCategory = cat
    }
  }

  // Priority: check for urgency signals
  const urgencyHits = URGENCY_WORDS.reduce((sum, w) => sum + (lower.includes(w) ? 1 : 0), 0)
  let priority: Classification['priority'] = 'low'
  if (urgencyHits >= 3) priority = 'urgent'
  else if (urgencyHits >= 2) priority = 'high'
  else if (urgencyHits >= 1) priority = 'medium'

  // Sentiment
  const negHits = NEGATIVE_WORDS.reduce((sum, w) => sum + (lower.includes(w) ? 1 : 0), 0)
  const posHits = POSITIVE_WORDS.reduce((sum, w) => sum + (lower.includes(w) ? 1 : 0), 0)
  let sentiment: Classification['sentiment'] = 'neutral'
  if (negHits > posHits) sentiment = 'negative'
  else if (posHits > negHits) sentiment = 'positive'

  return { category: bestCategory, priority, sentiment }
}

export function buildContext(ticket: Ticket, knowledgeBase: KBArticle[]): string {
  const classification = classifyTicket(ticket.content)
  const words = ticket.content.toLowerCase().split(/\s+/)

  // Score KB articles by keyword overlap
  const scored = knowledgeBase.map((article) => {
    const articleWords = new Set(
      (article.title + ' ' + article.body + ' ' + article.tags.join(' '))
        .toLowerCase()
        .split(/\s+/),
    )
    const overlap = words.filter((w) => w.length > 3 && articleWords.has(w)).length
    return { article, score: overlap }
  })

  scored.sort((a, b) => b.score - a.score)
  const relevant = scored.filter((s) => s.score > 0).slice(0, 3)

  const lines: string[] = [
    `Ticket ID: ${ticket.id}`,
    `Customer: ${ticket.customerName}`,
    `Category: ${classification.category}`,
    `Priority: ${classification.priority}`,
    `Sentiment: ${classification.sentiment}`,
    '',
    `Customer message:`,
    ticket.content,
  ]

  if (relevant.length > 0) {
    lines.push('', '--- Relevant KB Articles ---')
    for (const { article, score } of relevant) {
      lines.push(`[${article.id}] ${article.title} (relevance: ${score})`)
      lines.push(article.body.slice(0, 500))
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function formatResponse(agentReply: string, ticket: Ticket): string {
  const greeting = `Hi ${ticket.customerName},`
  const signature = [
    '',
    '---',
    `Reference: ${ticket.id}`,
    'If this doesn\'t resolve your issue, reply to this message and we\'ll follow up.',
  ].join('\n')

  return `${greeting}\n\n${agentReply}\n${signature}`
}
