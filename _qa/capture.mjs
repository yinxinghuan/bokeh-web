import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, '_qa', 'ui')
await mkdir(output, { recursive: true })

const server = spawn(process.execPath, [
  path.join(root, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1',
  '--port', '4189',
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
let serverError = ''
server.stderr.on('data', (chunk) => { serverError += chunk.toString() })

const waitForServer = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Vite did not start')), 15000)
  server.stdout.on('data', (chunk) => {
    if (chunk.toString().includes('Local:')) {
      clearTimeout(timer)
      resolve()
    }
  })
  server.on('exit', (code) => reject(new Error(`Vite exited early: ${code}\n${serverError}`)))
})

try {
  await waitForServer
  const browser = await chromium.launch({ headless: true })
  const errors = []
  const blockGuestShell = (page) => page.route('**/alteru/guest-shell.js', (route) => route.abort())

  const delayed = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 MicroMessenger MiniProgram',
  })
  await blockGuestShell(delayed)
  await delayed.goto('http://127.0.0.1:4189/?renderer=direct&boot_delay=1400', { waitUntil: 'domcontentloaded' })
  await delayed.waitForTimeout(350)
  await delayed.screenshot({ path: path.join(output, '390x844-mini-loading.png') })
  const loadingState = await delayed.evaluate(() => ({
    bootPresent: Boolean(document.querySelector('.boot-bridge')),
    wakeDisabled: document.querySelector('.wake')?.disabled,
    sleepingOpacity: getComputedStyle(document.querySelector('.sleeping')).opacity,
  }))
  if (loadingState.bootPresent || !loadingState.wakeDisabled || loadingState.sleepingOpacity !== '1') {
    errors.push(`mini delayed startup: invalid loading surface ${JSON.stringify(loadingState)}`)
  }
  await delayed.waitForFunction(() => !document.querySelector('.wake')?.disabled)
  await delayed.close()

  for (const viewport of [
    { width: 390, height: 844, name: '390x844' },
    { width: 320, height: 568, name: '320x568' },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    })
    await blockGuestShell(page)
    page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error.message}`))
    await page.goto('http://127.0.0.1:4189/', { waitUntil: 'domcontentloaded' })
    await page.screenshot({ path: path.join(output, `${viewport.name}-sleeping.png`) })
    await page.locator('.wake').tap()
    await page.waitForFunction(() => document.body.dataset.visualReady === 'true')
    await page.screenshot({ path: path.join(output, `${viewport.name}-awake.png`) })
    const canvas = page.locator('canvas').last()
    const box = await canvas.boundingBox()
    if (!box) throw new Error(`${viewport.name}: no rendered canvas`)
    for (let i = 0; i < 3; i += 1) {
      await page.mouse.click(box.x + box.width * .5, box.y + box.height * .5)
      await page.waitForTimeout(450)
    }
    await page.screenshot({ path: path.join(output, `${viewport.name}-complete.png`) })
    const result = await page.evaluate(() => ({
      locked: document.querySelectorAll('.focus-marks .is-locked').length,
      restartVisible: !(document.querySelector('.restart')?.hidden),
      canvasCount: document.querySelectorAll('canvas').length,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
    }))
    if (result.locked !== 3 || !result.restartVisible || result.canvasCount < 1) {
      errors.push(`${viewport.name}: invalid state ${JSON.stringify(result)}`)
    }
    if (result.scrollWidth > result.innerWidth) {
      errors.push(`${viewport.name}: horizontal overflow ${JSON.stringify(result)}`)
    }
    await page.close()
  }

  for (const viewport of [
    { width: 390, height: 844, name: '390x844' },
    { width: 320, height: 568, name: '320x568' },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
      userAgent: 'Mozilla/5.0 MicroMessenger MiniProgram',
    })
    await blockGuestShell(page)
    page.on('pageerror', (error) => errors.push(`${viewport.name} mini: ${error.message}`))
    await page.goto('http://127.0.0.1:4189/?renderer=direct', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => !document.querySelector('.boot-bridge'))
    await page.screenshot({ path: path.join(output, `${viewport.name}-mini-sleeping.png`) })
    await page.locator('.wake').tap()
    await page.waitForFunction(() => document.body.dataset.visualReady === 'true')
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(output, `${viewport.name}-mini-awake.png`) })
    const canvas = page.locator('canvas').last()
    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) {
      errors.push(`${viewport.name} mini: canvas bounds missing`)
    } else {
      for (let index = 0; index < 3; index += 1) {
        await page.mouse.click(canvasBox.x + canvasBox.width * .5, canvasBox.y + canvasBox.height * .5)
        await page.waitForTimeout(180)
      }
      await page.screenshot({ path: path.join(output, `${viewport.name}-mini-complete.png`) })
    }
    const state = await page.evaluate(() => ({
      renderer: document.body.dataset.bokehRenderer,
      ready: document.body.dataset.visualReady,
      sleeping: getComputedStyle(document.querySelector('.sleeping')).pointerEvents,
      canvasCount: document.querySelectorAll('canvas').length,
      locked: document.querySelectorAll('.focus-marks .is-locked').length,
      restartVisible: !(document.querySelector('.restart')?.hidden),
    }))
    if (state.renderer !== 'direct' || state.ready !== 'true' || state.sleeping !== 'none' || state.canvasCount < 1 || state.locked !== 3 || !state.restartVisible) {
      errors.push(`${viewport.name} mini: invalid startup ${JSON.stringify(state)}`)
    }
    await page.close()
  }

  const baselinePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await blockGuestShell(baselinePage)
  baselinePage.on('pageerror', (error) => errors.push(`baseline: ${error.message}`))
  await baselinePage.goto('http://127.0.0.1:4189/?baseline=1', { waitUntil: 'domcontentloaded' })
  await baselinePage.waitForFunction(() => document.body.dataset.visualReady === 'true')
  await baselinePage.screenshot({ path: path.join(output, '390x844-baseline.png') })
  const baselineState = await baselinePage.evaluate(() => ({
    canvasCount: document.querySelectorAll('canvas').length,
    hudDisplay: getComputedStyle(document.querySelector('.hud')).display,
  }))
  if (baselineState.canvasCount < 1 || baselineState.hudDisplay !== 'none') {
    errors.push(`baseline: invalid state ${JSON.stringify(baselineState)}`)
  }
  await baselinePage.close()
  await browser.close()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`QA passed. Screenshots: ${output}`)
} finally {
  server.kill('SIGTERM')
}
