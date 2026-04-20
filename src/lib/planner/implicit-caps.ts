// Archetype-based capability inference. Runs AFTER the explicit keyword-driven
// detectCapabilities and AFTER framework-level defaults (tailwind/shadcn) are
// attached. Attaches implicit UI capabilities based on the product archetype
// inferred from the prompt shape — NOT from literal capability keywords.
//
// Rules (web-producing families only — starter and workspace-web alike):
//
// 1. SaaS UI base: for any frontend product that is not a chat-only surface,
//    attach `capability:layout-dashboard`. AI SaaS prompts ("build me an AI X
//    tool"), data/analytics prompts, and admin/operations products all need a
//    dashboard shell — the #1 missed layer on ideasai (51x).
//
// 2. Chat archetype: when the product is a conversational surface (chatbot,
//    AI assistant/tutor/companion, symptom checker, homework helper), attach
//    `capability:layout-chat` and SKIP `layout-dashboard` (jaccard penalises
//    extra layers).
//
// 3. `capability:ai-chat-ui`: attach whenever the prompt describes an AI-
//    powered product (literal "AI <product>") on a web family. AI SaaS almost
//    always ships a chat surface somewhere — missed 24x on ideasai.
//
// 4. `capability:chart-widget`: attach when data-viz signals are present
//    (analytics, tracking, trends, portfolio, performance, reporting, etc.)
//    — chart-widget has no manifest keywords, so it was never detected.
//    Missed 16x on ideasai.
//
// Pure string→string[] mapping with zero I/O, deterministic, adds at most 4
// layer strings. No family/kind routing changes.

import { hasAny } from '../keywords.js'
import {
  ADMIN_ARCHETYPE_SIGNALS,
  AI_PRODUCT_PHRASES,
  AUTH_ARCHETYPE_SIGNALS,
  CHART_STRONG_SIGNALS,
  CHAT_ARCHETYPE_SIGNALS,
  CODE_EDITOR_ARCHETYPE_SIGNALS,
  DATE_HEAVY_ARCHETYPE_SIGNALS,
  IMPLICIT_UI_FAMILIES,
  VIDEO_ARCHETYPE_SIGNALS,
  ZK_BROWSER_ARCHETYPE_SIGNALS,
} from './signals.js'

function isAiProductPrompt(text: string): boolean {
  return hasAny(text, AI_PRODUCT_PHRASES)
}

// Chatbot-style product — prompt describes a bot/assistant product even when
// the word "AI" doesn't appear (e.g. "customer support chatbot for Shopify").
function isChatbotStyleProduct(text: string): boolean {
  return hasAny(text, ['chatbot', 'chat bot', 'slack bot', 'discord bot', 'support bot', 'voice bot', 'phone agent'])
}

export function inferImplicitCapabilities(
  text: string,
  family: string,
  existing: Set<string>,
): string[] {
  if (!IMPLICIT_UI_FAMILIES.has(family)) return []

  const out: string[] = []
  const has = (layer: string): boolean => existing.has(layer) || out.includes(layer)

  const isChat = hasAny(text, CHAT_ARCHETYPE_SIGNALS)
  const isAi = isAiProductPrompt(text)
  const isChatbot = isChatbotStyleProduct(text)
  const hasChartSignal = hasAny(text, CHART_STRONG_SIGNALS)
  const isVideo = hasAny(text, VIDEO_ARCHETYPE_SIGNALS)
  const chatAlreadyAttached = has('capability:layout-chat')

  // Video/webrtc products take precedence over chat archetype — "video rooms
  // with a quick chat" is a video product, not a chat product.
  if (isVideo && !has('capability:webrtc')) {
    out.push('capability:webrtc')
  }

  // Chat archetype is only "real" when there's no video surface. Video products
  // that casually mention "chat" (co-working, video+chat apps) should stay on
  // the dashboard layout.
  const chatArchetype = !isVideo && (isChat || isChatbot || chatAlreadyAttached)

  // AI-powered product OR explicit chatbot-shape product → ai-chat-ui.
  // On web families these products virtually always ship a chat surface even
  // when the user didn't spell out "chat interface".
  if ((isAi || isChatbot) && !has('capability:ai-chat-ui')) {
    out.push('capability:ai-chat-ui')
  }

  // Chat archetype → layout-chat (skip if explicit detection already added it).
  if (!isVideo && (isChat || isChatbot) && !chatAlreadyAttached) {
    out.push('capability:layout-chat')
  }

  // Default SaaS layout is the sidebar dashboard. Skip when the product is a
  // chat surface OR when the prompt explicitly wants a landing page only.
  const isLandingOnly =
    hasAny(text, ['landing page', 'marketing page', 'blog']) &&
    !hasAny(text, ['dashboard', 'admin', 'app', 'saas', 'portal', 'panel'])
  const shouldDashboard =
    !chatArchetype && !isLandingOnly && !has('capability:layout-dashboard')
  if (shouldDashboard) {
    out.push('capability:layout-dashboard')
  }

  // Chart widget fires on STRONG data-viz signals only. Skipped on chat
  // products (corpus never expects chart on chat) to keep jaccard tight.
  if (hasChartSignal && !chatArchetype && !has('capability:chart-widget')) {
    out.push('capability:chart-widget')
  }

  // Admin/portal archetypes layer on top of layout-dashboard.
  if (hasAny(text, ADMIN_ARCHETYPE_SIGNALS) && !has('capability:layout-admin')) {
    out.push('capability:layout-admin')
  }

  if (hasAny(text, AUTH_ARCHETYPE_SIGNALS) && !has('capability:layout-auth')) {
    out.push('capability:layout-auth')
  }

  // Code-editor surface (AI playgrounds, SQL editors, markdown with code).
  // Detector flagged codemirror installed 15× across agent-trading — scaffold
  // needed a pre-built editor component.
  if (hasAny(text, CODE_EDITOR_ARCHETYPE_SIGNALS) && !has('capability:code-editor')) {
    out.push('capability:code-editor')
  }

  // Date-heavy products: calendar, scheduling, booking, deadline tracking.
  // date-fns is tree-shakeable so this is a cheap attach.
  if (hasAny(text, DATE_HEAVY_ARCHETYPE_SIGNALS) && !has('capability:date-utils')) {
    out.push('capability:date-utils')
  }

  // Browser-native ZK: mixer, private voting, anonymous credential flows.
  // Detector surfaced snarkjs+circomlibjs 4× each on zk-mixer-ui with 0% pass;
  // the scaffold previously had no way to ship these packages (no layer
  // declared packageDeps until LayerManifest.packageDeps landed 2026-04-20).
  if (hasAny(text, ZK_BROWSER_ARCHETYPE_SIGNALS) && !has('capability:zk-browser')) {
    out.push('capability:zk-browser')
  }

  return out
}
