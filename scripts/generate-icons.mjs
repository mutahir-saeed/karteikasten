import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const iconsDir = join(pub, 'icons')

// A little index card on a brass drawer, with a serif "K".
function svg({ maskable }) {
  const pad = maskable ? 64 : 0 // maskable needs safe padding
  const s = 512
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#7a5c2e"/>
  <rect width="${s}" height="${s}" fill="url(#g)"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a75a"/>
      <stop offset="1" stop-color="#7a5c2e"/>
    </linearGradient>
  </defs>
  <g transform="translate(${pad},${pad + 18})">
    <rect x="${76 - pad}" y="${86 - pad}" width="${360 + pad * 0}" height="300" rx="26"
      transform="rotate(-6 256 236)" fill="#fbf6e9" stroke="#2b2620" stroke-opacity="0.15" stroke-width="3"/>
    <rect x="${86 - pad}" y="${96 - pad}" width="360" height="300" rx="26" fill="#fbf6e9"
      stroke="#2b2620" stroke-opacity="0.12" stroke-width="3"/>
    <line x1="${132 - pad}" y1="${110 - pad}" x2="${132 - pad}" y2="${386 - pad}" stroke="#c0402b" stroke-width="5"/>
    <text x="${300 - pad}" y="${320 - pad}" font-family="Georgia, 'Playfair Display', serif" font-weight="700"
      font-size="240" fill="#2b2620" text-anchor="middle">K</text>
  </g>
</svg>`
}

async function main() {
  await mkdir(iconsDir, { recursive: true })

  const plain = Buffer.from(svg({ maskable: false }))
  const mask = Buffer.from(svg({ maskable: true }))

  const jobs = [
    ['icon-192.png', plain, 192],
    ['icon-512.png', plain, 512],
    ['maskable-192.png', mask, 192],
    ['maskable-512.png', mask, 512],
    ['apple-touch-icon.png', plain, 180],
  ]
  for (const [name, buf, size] of jobs) {
    const out = name === 'apple-touch-icon.png' ? join(pub, name) : join(iconsDir, name)
    await sharp(buf).resize(size, size).png().toFile(out)
    console.log('wrote', name)
  }
  // favicon as SVG (crisp at any size)
  await writeFile(join(pub, 'favicon.svg'), svg({ maskable: false }))
  console.log('wrote favicon.svg')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
