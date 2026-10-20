// Renders public/icons/icon.svg into the PNG icons required by the manifest and iOS.
import { copyFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const iconsDir = join(import.meta.dirname, '..', 'public', 'icons')

const outputs = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

const svg = await readFile(join(iconsDir, 'icon.svg'))

for (const { file, size } of outputs) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(join(iconsDir, file))
  console.log(`✓ ${file} (${size}×${size})`)
}

await copyFile(join(iconsDir, 'icon.svg'), join(iconsDir, '..', 'favicon.svg'))
console.log('✓ favicon.svg')
