import { Application, Graphics, Text } from 'pixi.js'

const canvas = document.getElementById('stage') as HTMLCanvasElement
if (!canvas) throw new Error('#stage canvas missing from index.html')

const app = new Application()

await app.init({
  canvas,
  width: window.innerWidth,
  height: window.innerHeight,
  background: '#0b0d10',
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio, 2),
  preference: 'webgpu',
})

const title = new Text({
  text: 'Starter Foundry — Pixi v8',
  style: { fill: '#d5deeb', fontSize: 18, fontFamily: 'system-ui' },
})
title.x = 24
title.y = 24
app.stage.addChild(title)

const badge = new Graphics()
  .roundRect(-60, -60, 120, 120, 16)
  .fill({ color: 0x6ea8ff, alpha: 0.85 })
  .stroke({ color: 0xffffff, width: 2, alpha: 0.2 })
badge.position.set(app.screen.width / 2, app.screen.height / 2)
app.stage.addChild(badge)

app.ticker.add((tick) => {
  badge.rotation += 0.01 * tick.deltaTime
})

function onResize(): void {
  app.renderer.resize(window.innerWidth, window.innerHeight)
  badge.position.set(app.screen.width / 2, app.screen.height / 2)
}
window.addEventListener('resize', onResize)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('resize', onResize)
    app.destroy(true, { children: true, texture: true, textureSource: true })
  })
}
