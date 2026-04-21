import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'

const canvas = document.getElementById('scene') as HTMLCanvasElement
if (!canvas) throw new Error('#scene canvas missing from index.html')

const renderer = new WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

const scene = new Scene()

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(2, 2, 3)
camera.lookAt(0, 0, 0)

scene.add(new AmbientLight(0xffffff, 0.6))
const key = new DirectionalLight(0xffffff, 0.9)
key.position.set(3, 4, 5)
scene.add(key)

const cube = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshStandardMaterial({ color: 0x6ea8ff, roughness: 0.35, metalness: 0.1 }),
)
scene.add(cube)

let rafHandle = 0
function tick(): void {
  cube.rotation.x += 0.008
  cube.rotation.y += 0.012
  renderer.render(scene, camera)
  rafHandle = requestAnimationFrame(tick)
}
tick()

function onResize(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', onResize)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(rafHandle)
    window.removeEventListener('resize', onResize)
    cube.geometry.dispose()
    ;(cube.material as MeshStandardMaterial).dispose()
    renderer.dispose()
  })
}
