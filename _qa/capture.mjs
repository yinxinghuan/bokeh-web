import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
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
    page.on('pageerror', (error) => errors.push(`${viewport.name}: ${error.message}`))
    await page.goto('http://127.0.0.1:4189/', { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(output, `${viewport.name}-sleeping.png`) })
    await page.locator('.wake').tap()
    await page.waitForTimeout(7000)
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
  const baselinePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  baselinePage.on('pageerror', (error) => errors.push(`baseline: ${error.message}`))
  await baselinePage.goto('http://127.0.0.1:4189/?baseline=1', { waitUntil: 'networkidle' })
  await baselinePage.waitForTimeout(7000)
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
