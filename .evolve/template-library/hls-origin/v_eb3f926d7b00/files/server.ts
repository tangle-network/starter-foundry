// HLS origin control plane.
//
// nginx serves the .m3u8 + .ts segments directly (zero-copy sendfile, CORS
// already handled in nginx.conf). This Node server is the management plane:
// it reports which streams are currently being transcoded by scanning the
// shared hls-data volume for stream.m3u8 playlists.
//
// Extend with: auth, per-stream start/stop, multi-bitrate ladder selection,
// webhook fire on stream-start / stream-end events.

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'

const port = Number(process.env.PORT ?? '{{port}}') || 8099
const nginxPort = Number(process.env.NGINX_PORT ?? '{{nginxPort}}') || 8080
const hlsRoot = process.env.HLS_ROOT ?? '/var/www/hls'

interface StreamInfo {
  name: string
  playlistUrl: string
  segmentCount: number
  lastModifiedMs: number
}

async function listStreams(): Promise<StreamInfo[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(hlsRoot)
  } catch {
    return []
  }
  const results: StreamInfo[] = []
  for (const name of entries) {
    const dir = path.join(hlsRoot, name)
    const playlist = path.join(dir, 'stream.m3u8')
    try {
      const stat = await fs.stat(playlist)
      const segments = (await fs.readdir(dir)).filter((f) => f.endsWith('.ts'))
      results.push({
        name,
        playlistUrl: `http://localhost:${nginxPort}/hls/${name}/stream.m3u8`,
        segmentCount: segments.length,
        lastModifiedMs: stat.mtimeMs,
      })
    } catch {
      // directory without a playlist yet — stream starting up, skip.
    }
  }
  return results.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  res.setHeader('content-type', 'application/json')

  if (req.method === 'GET' && url.pathname === '/health') {
    res.end(
      JSON.stringify({
        status: 'ok',
        service: '{{serviceName}}',
        hlsRoot,
        nginxPort,
      }),
    )
    return
  }

  if (req.method === 'GET' && url.pathname === '/streams') {
    const streams = await listStreams()
    res.end(JSON.stringify({ streams }))
    return
  }

  res.statusCode = 404
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(port, () => {
  console.log(`{{serviceName}} control plane on http://localhost:${port}`)
  console.log(`  HLS segments:    http://localhost:${nginxPort}/hls/<name>/stream.m3u8`)
  console.log(`  List streams:    GET  /streams`)
})
