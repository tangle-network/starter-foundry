// Per-lane project builders. Each build*Project function takes a prompt and
// partner, picks the right family + layers + slots, and returns a ProjectEntry
// ready to slot into a workspace spec.
//
// Family choice is driven by chooseApiFamily / chooseWorkerFamily (which also
// lives here since the choice is a project-builder concern). Contract-lane
// builders live in ./contracts.ts alongside the agent-family selection.

import type { Registry } from '../../types.js'
import type { ProjectEntry } from '../../types.js'
import { detectCapabilities, detectLane, hasAny } from '../keywords.js'

import { chooseAgentFamily } from './contracts.js'
import {
  detectAuthSlot,
  detectDatabaseSlot,
  detectEvmSupportApiPattern,
  detectPaymentsSlot,
  detectQueueSlot,
  detectSdkSlot,
} from './detectors.js'
import { hasEvmDomainPackSupportApiSurface } from './domain-pack-signals.js'
import { buildSlug, resolvePartnerForFamily } from './helpers.js'
import { inferImplicitCapabilities } from './implicit-caps.js'

interface FamilyChoice {
  family: string
  layers: string[]
  path: string
  variables?: Record<string, string>
}

export function buildWebProject(
  prompt: string,
  partner: string | null,
  text: string,
  registry?: Registry,
): ProjectEntry {
  // WASM-Rust fronts take precedence over React/Next when the prompt
  // specifically asks for Rust-in-browser compute.
  if (
    hasAny(text, [
      'wasm-bindgen',
      'wasm-pack',
      'rust wasm',
      'rust in browser',
      'webassembly rust',
      'browser wasm',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'wasm-rust',
        layers: ['framework:wasm-rust'],
        partner: resolvePartnerForFamily(partner, 'wasm-rust'),
        slots: {},
        variables: {
          headline: 'Rust + WASM in your browser',
          subheadline: 'Native-speed compute shipped as a 20-line call from the frontend.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }

  // Three.js 3D scene / WebGL game surfaces.
  if (
    hasAny(text, [
      'three.js',
      'threejs',
      'webgl 3d scene',
      '3d model viewer',
      'gltf viewer',
      '3d scene editor',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'threejs-game',
        layers: ['framework:threejs-game'],
        partner: resolvePartnerForFamily(partner, 'threejs-game'),
        slots: {},
        variables: {
          headline: 'Render a live 3D scene on the first frame',
          subheadline:
            'Three.js + Vite starter with renderer, camera, and resize loop wired from the first render.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }

  // Phaser 3 2D game surfaces.
  if (hasAny(text, ['phaser', 'phaser 3', '2d arcade game', 'html5 game', 'platformer'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'phaser-game',
        layers: ['framework:phaser-game'],
        partner: resolvePartnerForFamily(partner, 'phaser-game'),
        slots: {},
        variables: {
          headline: 'A playable 2D loop on frame 1',
          subheadline: 'Phaser 3 + arcade physics with a scene, sprite, and input ready to extend.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }

  // Pixi.js v8 interactive 2D canvas surfaces.
  if (hasAny(text, ['pixi.js', 'pixijs', 'pixi v8', '2d webgpu', 'interactive canvas'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'pixijs-game',
        layers: ['framework:pixijs-game'],
        partner: resolvePartnerForFamily(partner, 'pixijs-game'),
        slots: {},
        variables: {
          headline: 'A 2D renderer with real pixels on frame 1',
          subheadline:
            'Pixi v8 + Vite starter with async Application init + WebGPU-preferred renderer.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }

  // Eleventy / Hugo / Zola static sites. Routed before the generic React path
  // so "eleventy blog" etc. don't fall through to react-vite-ts.
  if (hasAny(text, ['eleventy', '11ty', '@11ty', 'nunjucks layout'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'eleventy-static',
        layers: ['framework:eleventy-static'],
        partner: resolvePartnerForFamily(partner, 'eleventy-static'),
        slots: {},
        variables: {
          headline: 'Content in minutes with 11ty',
          subheadline: 'Eleventy + Nunjucks layouts, no client JS by default.',
        },
        primaryArtifactTargetMs: 2500,
      },
    }
  }
  if (hasAny(text, ['hugo site', 'hugo static', 'hugo blog', 'hugo layout'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'hugo-static',
        layers: ['framework:hugo-static'],
        partner: resolvePartnerForFamily(partner, 'hugo-static'),
        slots: {},
        variables: {
          headline: 'Hugo — fast, binary-driven static sites',
          subheadline: 'Go-based SSG with Tera templates and sub-second builds.',
        },
        primaryArtifactTargetMs: 2500,
      },
    }
  }
  if (hasAny(text, ['zola', 'zola site', 'zola static', 'tera template'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'zola-static',
        layers: ['framework:zola-static'],
        partner: resolvePartnerForFamily(partner, 'zola-static'),
        slots: {},
        variables: {
          headline: 'Zola — Rust-native SSG',
          subheadline: 'Single-binary static site generator with built-in SASS.',
        },
        primaryArtifactTargetMs: 2500,
      },
    }
  }
  if (hasAny(text, ['jupyter book', 'jupyterbook', 'myst-nb', 'executable book'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'jupyter-book',
        layers: ['framework:jupyter-book'],
        partner: resolvePartnerForFamily(partner, 'jupyter-book'),
        slots: {},
        variables: {
          headline: 'Executable book',
          subheadline: 'Jupyter Book with MyST code cells.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }
  if (
    hasAny(text, ['observable framework', 'observable notebook', 'observablehq', 'observable plot'])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'observable-notebook',
        layers: ['framework:observable-notebook'],
        partner: resolvePartnerForFamily(partner, 'observable-notebook'),
        slots: {},
        variables: {
          headline: 'Data stories with Observable',
          subheadline: 'Observable Framework + Plot charts, Markdown-first.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }
  // Specialized Streamlit (multipage + caching) must come BEFORE python-data-app
  // so "streamlit multipage" prompts don't fall through to the generic one.
  if (
    hasAny(text, [
      'streamlit multipage',
      'multipage streamlit',
      'production streamlit',
      'streamlit dashboard app',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'streamlit-advanced',
        layers: ['framework:streamlit-advanced'],
        partner: resolvePartnerForFamily(partner, 'streamlit-advanced'),
        slots: {},
        variables: {
          headline: 'Production Streamlit',
          subheadline: 'Multipage + caching + Plotly.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }

  // WebGPU compute vs render (both beat generic React path).
  if (
    hasAny(text, [
      'webgpu compute',
      'webgpu inference',
      'wgsl compute',
      'browser ml',
      'transformers.js',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'webgpu-inference',
        layers: ['framework:webgpu-inference'],
        partner: resolvePartnerForFamily(partner, 'webgpu-inference'),
        slots: {},
        variables: {
          headline: 'GPU compute in the browser',
          subheadline: 'Raw WebGPU matmul on Float32 buffers.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }
  if (
    hasAny(text, [
      'webgpu rendering',
      'raw webgpu',
      'wgsl graphics',
      'wgsl vertex',
      'low-level gpu graphics',
      'webgpu triangle',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'webgpu-render',
        layers: ['framework:webgpu-render'],
        partner: resolvePartnerForFamily(partner, 'webgpu-render'),
        slots: {},
        variables: {
          headline: 'Raw WebGPU renderer',
          subheadline: 'WGSL vertex + fragment, no three.js.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }

  // Bevy / Godot / Unity web targets.
  if (hasAny(text, ['bevy', 'bevy web', 'rust web game', 'wasm game engine'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'bevy-web',
        layers: ['framework:bevy-web'],
        partner: resolvePartnerForFamily(partner, 'bevy-web'),
        slots: {},
        variables: {
          headline: 'Bevy + Trunk',
          subheadline: 'Rust game engine compiled to WASM for the browser.',
        },
        primaryArtifactTargetMs: 4000,
      },
    }
  }
  if (hasAny(text, ['godot', 'godot web', 'godot html5', 'godot 4', 'gdscript'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'godot-web',
        layers: ['framework:godot-web'],
        partner: resolvePartnerForFamily(partner, 'godot-web'),
        slots: {},
        variables: {
          headline: 'Godot 4 on the web',
          subheadline: 'HTML5 export with COOP/COEP headers wired.',
        },
        primaryArtifactTargetMs: 4000,
      },
    }
  }
  if (hasAny(text, ['unity webgl', 'unity web build', 'unity batch mode', 'unity html5'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'unity-web-proxy',
        layers: ['framework:unity-web-proxy'],
        partner: resolvePartnerForFamily(partner, 'unity-web-proxy'),
        slots: {},
        variables: {
          headline: 'Unity WebGL host',
          subheadline: 'Serving shell + batch-mode build scripts.',
        },
        primaryArtifactTargetMs: 4000,
      },
    }
  }

  // Rich mobile (Expo + Skia + Reanimated) must come BEFORE the plain
  // expo-react-native-ts route — tier1 keywords on expo-rn-rich are
  // Skia/Reanimated/gesture-specific.
  if (
    hasAny(text, [
      'skia',
      'react native skia',
      'reanimated',
      'rich animations mobile',
      'native gestures mobile',
      'expo skia',
      'expo reanimated',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/mobile',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-mobile`,
        family: 'expo-rn-rich',
        layers: ['framework:expo-rn-rich'],
        partner: resolvePartnerForFamily(partner, 'expo-rn-rich'),
        slots: {},
        variables: {
          headline: 'Mobile app with Skia + Reanimated',
          subheadline: 'Rich GPU animations + gestures from frame 1.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }

  // Tauri variants — menubar (popover) and tray (daemon) must come BEFORE
  // generic tauri-desktop. Electron native-OS variant must come BEFORE
  // plain electron-desktop-ts.
  if (
    hasAny(text, [
      'menu bar app',
      'macos menubar',
      'floating panel app',
      'raycast-like',
      'menubar popover',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/desktop',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-desktop`,
        family: 'tauri-menubar',
        layers: ['framework:tauri-menubar'],
        partner: resolvePartnerForFamily(partner, 'tauri-menubar'),
        slots: {},
        variables: {
          headline: 'A compact panel in the menu bar',
          subheadline: 'Tauri popover tuned for Raycast-like flows.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }
  if (
    hasAny(text, [
      'system tray app',
      'tray icon only',
      'background daemon',
      'tauri tray',
      'tray daemon',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/desktop',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-desktop`,
        family: 'tauri-tray',
        layers: ['framework:tauri-tray'],
        partner: resolvePartnerForFamily(partner, 'tauri-tray'),
        slots: {},
        variables: {
          headline: 'Tray-only daemon',
          subheadline: 'No primary window — icon + menu + notifications.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }
  if (
    hasAny(text, [
      'native os integration',
      'custom protocol handler',
      'deep links desktop',
      'os notifications desktop',
      'auto updater electron',
      'electron native',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/desktop',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-desktop`,
        family: 'electron-native-os',
        layers: ['framework:electron-native-os'],
        partner: resolvePartnerForFamily(partner, 'electron-native-os'),
        slots: {},
        variables: {
          headline: 'Native OS integrations in Electron',
          subheadline: 'Menus, protocols, deep links, auto-update.',
        },
        primaryArtifactTargetMs: 3500,
      },
    }
  }

  // A/V + modality frontends.
  if (
    hasAny(text, [
      'voice agent',
      'voice first',
      'conversational voice',
      'speech to text agent',
      'browser mic agent',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'voice-first-agent',
        layers: ['framework:voice-first-agent'],
        partner: resolvePartnerForFamily(partner, 'voice-first-agent'),
        slots: {},
        variables: {
          headline: 'Talk to the product',
          subheadline: 'Browser mic → STT → LLM → TTS loop.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }
  if (
    hasAny(text, ['vision agent', 'camera agent', 'visual qa', 'screen understanding', 'ocr agent'])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'vision-first-agent',
        layers: ['framework:vision-first-agent'],
        partner: resolvePartnerForFamily(partner, 'vision-first-agent'),
        slots: {},
        variables: {
          headline: 'See what the user sees',
          subheadline: 'Camera → multimodal LLM → overlay.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }
  if (
    hasAny(text, [
      'multimodal agent',
      'multimodal input',
      'text image audio',
      'gpt-4o client',
      'claude vision voice',
      'multimodal chat',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'multimodal-agent',
        layers: ['framework:multimodal-agent'],
        partner: resolvePartnerForFamily(partner, 'multimodal-agent'),
        slots: {},
        variables: {
          headline: 'Text + image + audio, one pane',
          subheadline: 'Unified multipart POST to a multimodal endpoint.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }

  if (
    hasAny(text, [
      'realtime audio',
      'webaudio visualiz',
      'webaudio analyser',
      'peer audio',
      'webrtc audio',
    ])
  ) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'realtime-audio-ts',
        layers: ['framework:realtime-audio-ts'],
        partner: resolvePartnerForFamily(partner, 'realtime-audio-ts'),
        slots: {},
        variables: {
          headline: 'Live audio on canvas',
          subheadline: 'WebAudio + analyser + WebRTC peer seam.',
        },
        primaryArtifactTargetMs: 3000,
      },
    }
  }

  // Astro content/static sites.
  if (hasAny(text, ['astro', 'astrojs', 'astro islands', 'islands architecture', 'mdx site'])) {
    return {
      id: 'web',
      path: 'apps/web',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-web`,
        family: 'astro-static',
        layers: ['framework:astro-static'],
        partner: resolvePartnerForFamily(partner, 'astro-static'),
        slots: {},
        variables: {
          headline: 'Ship content fast with zero JS by default',
          subheadline:
            'Astro 5 static starter — islands architecture, file-based routing, MDX-ready.',
        },
        primaryArtifactTargetMs: 2500,
      },
    }
  }

  const isNext = hasAny(text, ['next', 'next.js', 'nextjs', 'app router', 'seo'])
  const family = isNext ? 'nextjs-ts' : 'react-vite-ts'
  const frameworkLayer = isNext ? 'framework:nextjs-app-router' : 'framework:react-vite-ts'
  const layers = [frameworkLayer]

  if (hasAny(text, ['dashboard', 'metrics', 'analytics', 'control plane', 'admin'])) {
    layers.push('capability:chart-widget')
  }

  const slots: Record<string, string> = {}
  const sdkSlot = detectSdkSlot(text, partner)
  const authSlot = detectAuthSlot(text)
  const paymentsSlot = detectPaymentsSlot(text)
  if (authSlot) slots.auth = authSlot
  if (paymentsSlot) slots.payments = paymentsSlot
  if (sdkSlot) slots.sdk = sdkSlot

  const webCapabilities = registry ? detectCapabilities(text, family, registry) : []
  if (webCapabilities.length > 0) layers.push(...webCapabilities)

  const implicit = inferImplicitCapabilities(text, family, new Set(layers))
  if (implicit.length > 0) layers.push(...implicit)

  // Force-attach tailwind + shadcn on every React family web project, same as
  // the starter path does. Without this, workspace scaffolds (UI + contracts)
  // lose the UI capability attachments agents then install manually —
  // visible in .evolve/capability-gaps.json as shadcn missed 20× / tailwind 14×.
  if (!layers.includes('capability:tailwind')) layers.push('capability:tailwind')
  if (!layers.includes('capability:shadcn')) layers.push('capability:shadcn')

  return {
    id: 'web',
    path: 'apps/web',
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-web`,
      family,
      layers: [...new Set(layers)],
      partner: resolvePartnerForFamily(partner, family),
      slots,
      variables: {
        headline: 'Ship the primary product surface first',
        subheadline:
          'This workspace starts with the user-visible surface before deepening the backend and contract lanes.',
      },
      primaryArtifactTargetMs: 2500,
    },
  }
}

function chooseWorkerFamily(text: string): FamilyChoice {
  if (hasAny(text, ['playwright', 'browser automation', 'web scraping', 'scraper', 'crawler'])) {
    return {
      family: 'playwright-worker',
      layers: ['framework:playwright-worker'],
      path: 'apps/worker',
    }
  }

  if (hasAny(text, ['go worker', 'golang worker', 'go cron', 'go queue', 'go background job'])) {
    return { family: 'go-worker', layers: ['framework:go-worker'], path: 'apps/worker' }
  }

  if (
    hasAny(text, [
      'python worker',
      'python cron',
      'python queue',
      'python background job',
      'celery',
      'python task',
    ])
  ) {
    return { family: 'python-worker', layers: ['framework:python-worker'], path: 'apps/worker' }
  }

  if (
    detectLane(text, 'agent') &&
    hasAny(text, ['worker', 'background', 'cron', 'queue', 'runner', 'executor'])
  ) {
    return { family: 'worker-job', layers: ['framework:node-worker'], path: 'apps/worker' }
  }

  const layers = ['framework:node-worker']
  if (hasAny(text, ['trading', 'market', 'feed', 'stream'])) {
    layers.push('capability:market-sim')
  }

  return { family: 'worker-job', layers, path: 'apps/worker' }
}

export function chooseApiFamily(
  text: string,
  options: { prompt?: string; partner?: string | null; registry?: Registry } = {},
): FamilyChoice {
  if (detectLane(text, 'x402'))
    return { family: 'x402-service', layers: ['framework:x402-service'], path: 'apps/api' }
  if (detectLane(text, 'mcp'))
    return { family: 'mcp-server-ts', layers: ['framework:mcp-server-ts'], path: 'apps/mcp' }
  if (detectLane(text, 'dspy'))
    return { family: 'dspy-pipeline-py', layers: ['framework:dspy-pipeline-py'], path: 'apps/ai' }

  // RAG pipeline (Python) — must come BEFORE vllm-server + python-api because
  // "Python RAG pipeline with Chroma and sentence-transformers" is more specific.
  if (
    hasAny(text, [
      'rag pipeline',
      'retrieval augmented',
      'chroma vector',
      'sentence-transformers',
      'semantic retrieval',
      'rag chroma',
    ])
  ) {
    return {
      family: 'rag-pipeline-py',
      layers: ['framework:rag-pipeline-py'],
      path: 'apps/inference',
    }
  }
  // Inference-serving variants that must beat vllm-server's generic terms.
  if (
    hasAny(text, ['tgi', 'text generation inference', 'huggingface tgi', 'hf inference server'])
  ) {
    return { family: 'tgi-server', layers: ['framework:tgi-server'], path: 'apps/inference' }
  }
  if (hasAny(text, ['sglang', 'radix attention', 'constrained generation', 'sglang server'])) {
    return { family: 'sglang-server', layers: ['framework:sglang-server'], path: 'apps/inference' }
  }
  if (
    hasAny(text, ['triton inference', 'nvidia triton', 'triton server', 'model repository triton'])
  ) {
    return { family: 'triton-server', layers: ['framework:triton-server'], path: 'apps/inference' }
  }
  if (hasAny(text, ['skypilot', 'sky serve', 'multi-cloud llm', 'spot inference', 'sky.yaml'])) {
    return {
      family: 'skypilot-serving',
      layers: ['framework:skypilot-serving'],
      path: 'apps/inference',
    }
  }
  if (
    hasAny(text, [
      'lora fine-tune',
      'lora training',
      'qlora',
      'peft adapter',
      'fine-tune llm',
      'sft training',
    ])
  ) {
    return { family: 'lora-training', layers: ['framework:lora-training'], path: 'apps/inference' }
  }

  // Media / realtime infrastructure.
  if (
    hasAny(text, [
      'livekit sfu',
      'self-hosted livekit',
      'selective forwarding unit',
      'webrtc sfu',
      'livekit server self-hosted',
    ])
  ) {
    return { family: 'livekit-sfu', layers: ['framework:livekit-sfu'], path: 'apps/api' }
  }
  if (
    hasAny(text, [
      'hls origin',
      'rtmp ingest',
      'm3u8 origin',
      'hls live streaming',
      'live streaming origin',
    ])
  ) {
    return { family: 'hls-origin', layers: ['framework:hls-origin'], path: 'apps/api' }
  }

  // Chain-specific families.
  if (
    hasAny(text, [
      'celestia',
      'data availability node',
      'blobstream',
      'celestia light node',
      'celestia blob',
    ])
  ) {
    return { family: 'celestia-da', layers: ['framework:celestia-da'], path: 'apps/api' }
  }

  // Industry-vertical APIs — opinionated schemas.
  if (
    hasAny(text, [
      'hipaa',
      'phi audit',
      'patient records',
      'healthcare backend',
      'healthcare compliance',
      'medical records',
    ])
  ) {
    return {
      family: 'healthcare-hipaa-backend',
      layers: ['framework:healthcare-hipaa-backend'],
      path: 'apps/api',
    }
  }
  if (
    hasAny(text, [
      'double entry',
      'double-entry',
      'ledger backend',
      'fintech accounting',
      'debit credit',
      'financial ledger',
    ])
  ) {
    return {
      family: 'fintech-ledger-backend',
      layers: ['framework:fintech-ledger-backend'],
      path: 'apps/api',
    }
  }
  if (
    hasAny(text, [
      'legal case',
      'case management',
      'matter management',
      'law practice',
      'attorney timekeeping',
      'legal billing',
    ])
  ) {
    return { family: 'legal-case-mgmt', layers: ['framework:legal-case-mgmt'], path: 'apps/api' }
  }
  if (
    hasAny(text, [
      'k-12',
      'k12',
      'edtech',
      'classroom management',
      'gradebook',
      'student information system',
    ])
  ) {
    return { family: 'k12-edtech', layers: ['framework:k12-edtech'], path: 'apps/api' }
  }
  if (
    hasAny(text, [
      'crm backend',
      'sales pipeline',
      'sales crm',
      'customer relationship',
      'deals pipeline',
    ])
  ) {
    return { family: 'crm-backend', layers: ['framework:crm-backend'], path: 'apps/api' }
  }
  if (
    hasAny(text, [
      'headless commerce',
      'ecommerce backend',
      'cart api',
      'checkout api',
      'product catalog api',
      'order management api',
    ])
  ) {
    return {
      family: 'ecommerce-headless',
      layers: ['framework:ecommerce-headless'],
      path: 'apps/api',
    }
  }

  // Multi-agent swarm — supervisor/worker orchestration. agent-swarm-ts is
  // TypeScript-only (LangGraph-JS). Python swarms (CrewAI, AutoGen) must fall
  // through to chooseAgentFamily which picks agent-service-py. Gate on the
  // absence of a Python language hint so 'Python CrewAI' prompts keep routing
  // to the Python agent family. Preserves held-out id=ho-python-crewai.
  const swarmSignals = hasAny(text, [
    'multi-agent',
    'agent swarm',
    'supervisor agent',
    'agent orchestration',
    'crewai',
    'agent handoff',
    'specialist agents',
    'agent team',
    'role-based agents',
  ])
  const isPythonHint = hasAny(text, [
    'python',
    'pydanticai',
    'autogen',
    'agno',
    'llamaindex',
    'unsloth',
    'qlora',
  ])
  if (swarmSignals && !isPythonHint) {
    return { family: 'agent-swarm-ts', layers: ['framework:agent-swarm-ts'], path: 'apps/swarm' }
  }
  if (detectLane(text, 'agent')) return chooseAgentFamily(text)
  if (detectLane(text, 'zk')) {
    // Dispatch to the specific zkVM family when the prompt names one; else
    // the generic zk-prover-service. Mirrors prompt-planner.ts workspace
    // branch — keep the two in sync.
    if (
      text.includes('risc zero') ||
      text.includes('risc0') ||
      text.includes('risczero') ||
      text.includes('bonsai')
    ) {
      return { family: 'risczero-zkvm', layers: ['framework:risczero-zkvm'], path: 'apps/prover' }
    }
    if (text.includes('sp1') || text.includes('succinct')) {
      return { family: 'sp1-zkvm', layers: ['framework:sp1-zkvm'], path: 'apps/prover' }
    }
    if (
      text.includes('arkworks') ||
      text.includes('hand-rolled r1cs') ||
      text.includes('custom snark circuit')
    ) {
      return {
        family: 'arkworks-prover',
        layers: ['framework:arkworks-prover'],
        path: 'apps/prover',
      }
    }
    return {
      family: 'zk-prover-service',
      layers: ['framework:zk-prover-service'],
      path: 'apps/prover',
    }
  }
  if (
    (options.registry &&
      hasEvmDomainPackSupportApiSurface({
        prompt: options.prompt ?? text,
        partner: options.partner ?? null,
        registry: options.registry,
      })) ||
    detectLane(text, 'evm-infra')
  )
    return { family: 'evm-infra-ts', layers: ['framework:evm-infra-ts'], path: 'apps/api' }

  if (hasAny(text, ['cloudflare', 'durable object', 'edge api', 'edge function', 'hono edge'])) {
    return {
      family: 'cloudflare-worker-ts',
      layers: ['framework:cloudflare-worker-ts'],
      path: 'apps/edge',
    }
  }
  // Bun must be checked before the generic Node path below. "bun" alone is a
  // stronger signal than the fuzzier Node defaults.
  if (hasAny(text, ['bun', 'bun.serve', 'bun runtime', 'bun api', 'bun http', 'bun.js'])) {
    return { family: 'bun-http', layers: ['framework:bun-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['deno', 'deno.serve', 'deno runtime', 'deno deploy', 'deno edge'])) {
    return { family: 'deno-edge', layers: ['framework:deno-edge'], path: 'apps/api' }
  }
  // Ollama local-first inference — must come BEFORE vllm-server so prompts that
  // explicitly mention ollama/gguf/local llm pick the local-first path instead
  // of the GPU-first vllm path.
  if (
    hasAny(text, [
      'ollama',
      'ollama local',
      'local llm',
      'gguf',
      'llama.cpp',
      'on-device llm',
      'self-hosted inference',
      'ollama modelfile',
    ])
  ) {
    return { family: 'ollama-server', layers: ['framework:ollama-server'], path: 'apps/inference' }
  }
  // LLM inference server — vLLM / self-hosted model serving / OpenAI-compatible.
  // Must come before python-api so prompts about "python llm inference server"
  // route to vllm-server instead of the generic python HTTP path.
  if (
    hasAny(text, [
      'vllm',
      'llm inference server',
      'llm serving',
      'self-hosted llm',
      'model serving',
      'serve llama',
      'openai-compatible api',
      'paged attention',
      'gpu inference',
      'inference server',
    ])
  ) {
    return { family: 'vllm-server', layers: ['framework:vllm-server'], path: 'apps/inference' }
  }
  if (hasAny(text, ['rust', 'cargo', 'axum', 'rust api', 'rust backend'])) {
    return { family: 'rust-service', layers: ['framework:rust-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['python', 'fastapi', 'flask', 'django', 'python api'])) {
    return { family: 'python-api', layers: ['framework:python-http'], path: 'apps/api' }
  }
  if (hasAny(text, ['golang', 'go api', 'go backend', 'go service', 'net/http'])) {
    return { family: 'go-api', layers: ['framework:go-net-http'], path: 'apps/api' }
  }

  return {
    family: 'api-service',
    layers: ['framework:node-http', 'capability:logging'],
    path: 'apps/api',
  }
}

export function buildApiProject(
  prompt: string,
  partner: string | null,
  text: string,
  registry?: Registry,
): ProjectEntry {
  const choice = chooseApiFamily(text, { prompt, partner, registry })
  const layers = [...choice.layers]
  const slots: Record<string, string> = {}
  const databaseSlot = detectDatabaseSlot(text)
  const sdkSlot = detectSdkSlot(text, partner)
  const authSlot = detectAuthSlot(text)
  const paymentsSlot = detectPaymentsSlot(text)
  const queueSlot = detectQueueSlot(text)

  if (databaseSlot) slots.database = databaseSlot
  if (authSlot) slots.auth = authSlot
  if (paymentsSlot) slots.payments = paymentsSlot
  if (queueSlot) slots.queue = queueSlot
  if (sdkSlot) slots.sdk = sdkSlot

  if (
    (choice.family === 'api-service' || choice.family === 'evm-infra-ts') &&
    detectEvmSupportApiPattern(text)
  ) {
    layers.push('capability:evm-protocol-api')
  }

  if (choice.family === 'evm-infra-ts') {
    if (hasAny(text, ['block monitor', 'new blocks', 'gas price', 'tps', '/stats'])) {
      layers.push('capability:evm-chain-monitor')
    } else if (hasAny(text, ['wallet balance', 'wallet address', 'multicall', 'summary table'])) {
      layers.push('capability:evm-wallet-dashboard')
    }
  }

  const apiCapabilities = registry ? detectCapabilities(text, choice.family, registry) : []
  if (apiCapabilities.length > 0) layers.push(...apiCapabilities)

  return {
    id: choice.family.startsWith('agent-service-') ? 'agent' : 'api',
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-api`,
      family: choice.family,
      layers: [...new Set(layers)],
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: choice.variables ?? {},
      primaryArtifactTargetMs: 2500,
    },
  }
}

export function buildWorkerProject(
  prompt: string,
  partner: string | null,
  text: string,
): ProjectEntry {
  const choice = chooseWorkerFamily(text)
  const layers = [...choice.layers]
  const slots: Record<string, string> = {}
  const queueSlot = detectQueueSlot(text)
  if (queueSlot) slots.queue = queueSlot

  if (
    choice.family === 'worker-job' &&
    hasAny(text, ['keeper', 'liquidation']) &&
    hasAny(text, ['solana', 'anchor', 'pyth', 'switchboard'])
  ) {
    layers.push('capability:solana-keeper')
  }

  return {
    id: 'worker',
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-worker`,
      family: choice.family,
      layers,
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: {
        workerName: partner ? `${partner} worker lane` : 'workspace worker lane',
      },
      primaryArtifactTargetMs: 2500,
    },
  }
}
