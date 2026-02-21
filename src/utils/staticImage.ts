import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(__dirname, '..', 'assets')

export function getBoardUrl(boardName: string): string {
  return path.join(assetsDir, 'background', `${boardName}.webp`)
}

export function getIconUrl(iconName: string): string {
  return path.join(assetsDir, 'objects', `${iconName}.webp`)
}
