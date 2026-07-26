type LegacyWindow = Window & {
  startBlurry: () => void
  cameraFocalDistance: number
  bokehStrength: number
  resetCanvas: () => void
  renderer: { domElement: HTMLCanvasElement }
}

const legacy = window as unknown as LegacyWindow
const sleeping = document.querySelector<HTMLElement>('.sleeping')!
const wake = document.querySelector<HTMLButtonElement>('.wake')!
const guide = document.querySelector<HTMLParagraphElement>('.guide p')!
const restart = document.querySelector<HTMLButtonElement>('.restart')!
const marks = [...document.querySelectorAll<HTMLElement>('.focus-marks i')]
const locale = localStorage.getItem('game_locale') === 'en'
  || (!localStorage.getItem('game_locale') && !navigator.language.toLowerCase().startsWith('zh'))
  ? 'en'
  : 'zh'
const copy = locale === 'zh'
  ? { wake: '触碰唤醒光学网', guide: '轻触校准焦面 · 拖动旋转', done: '三层焦面已锁定 · 拖动观看', restart: '重新校准' }
  : { wake: 'Touch to wake the optical web', guide: 'Tap to focus · drag to orbit', done: 'Three focal planes locked · drag to inspect', restart: 'Recalibrate' }
const focalPlanes = [
  { depth: 80, bokeh: 0.016 },
  { depth: 100, bokeh: 0.021 },
  { depth: 122, bokeh: 0.027 },
]
let progress = 0
let started = false
const baseline = new URLSearchParams(location.search).get('baseline') === '1'

wake.querySelector('span')!.textContent = copy.wake
guide.textContent = copy.guide
restart.textContent = copy.restart

function applyFocus(index: number) {
  const plane = focalPlanes[index]
  legacy.cameraFocalDistance = plane.depth
  legacy.bokehStrength = plane.bokeh
  legacy.resetCanvas()
  marks[index].classList.add('is-locked')
  progress = index + 1
  if (progress === focalPlanes.length) {
    guide.textContent = copy.done
    restart.hidden = false
  }
}

function attachCanvasGesture() {
  const canvas = legacy.renderer.domElement
  let originX = 0
  let originY = 0
  canvas.addEventListener('pointerdown', (event) => {
    originX = event.clientX
    originY = event.clientY
  })
  canvas.addEventListener('pointerup', (event) => {
    if (progress >= focalPlanes.length) return
    if (Math.hypot(event.clientX - originX, event.clientY - originY) < 10) applyFocus(progress)
  })
}

function startExperience() {
  if (started) return
  started = true
  try {
    legacy.startBlurry()
    sleeping.classList.add('is-awake')
    attachCanvasGesture()
  } catch {
    guide.textContent = locale === 'zh' ? '此设备不支持所需的 WebGL 浮点渲染' : 'This device cannot run the required WebGL float renderer'
    guide.style.pointerEvents = 'auto'
  }
}

wake.addEventListener('pointerdown', startExperience, { once: true })

if (baseline) {
  document.body.classList.add('is-baseline')
  startExperience()
}

restart.addEventListener('pointerdown', () => {
  progress = 0
  marks.forEach((mark) => mark.classList.remove('is-locked'))
  guide.textContent = copy.guide
  restart.hidden = true
  legacy.cameraFocalDistance = focalPlanes[0].depth
  legacy.bokehStrength = focalPlanes[0].bokeh
  legacy.resetCanvas()
})
