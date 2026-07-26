import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

interface WebAssetManifest {
  format: 'node-zsb-web-assets'
  version: 1
  webVersion: string
  stylesVersion: string
  vendorVersion: string
  assets: Record<string, string>
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceWebDir = path.join(rootDir, 'src', 'web')
const sourceSharedDir = path.join(rootDir, 'src', 'shared')
const sourceAssetsDir = path.join(rootDir, 'src', 'assets')
const distDir = path.join(rootDir, 'dist')
const distWebDir = path.join(distDir, 'web')
const distSharedDir = path.join(distDir, 'shared')

await Promise.all([
  rm(distWebDir, { force: true, recursive: true }),
  rm(distSharedDir, { force: true, recursive: true }),
])

await Promise.all([
  buildDirectory(sourceWebDir, distWebDir),
  buildDirectory(sourceSharedDir, distSharedDir),
])

const assetVersions = await collectAssetVersions()
const webVersion = await fingerprintJavaScript()
await Promise.all([
  rewriteJavaScriptImports(distWebDir, webVersion),
  rewriteJavaScriptImports(distSharedDir, webVersion),
])

const fontPath = '/assets/fonts/MiSans-Semibold.woff2'
const fontVersion = assetVersions[fontPath]
if (!fontVersion) throw new Error(`Missing browser asset version for ${fontPath}`)

const sourceStyles = await readFile(path.join(sourceWebDir, 'styles.css'), 'utf8')
const builtStyles = replaceRequired(
  sourceStyles,
  '../assets/fonts/MiSans-Semibold.woff2',
  `../assets/fonts/MiSans-Semibold.woff2?v=${fontVersion}`,
)
const stylesVersion = fingerprint(Buffer.from(builtStyles))
await writeFile(path.join(distWebDir, 'styles.css'), builtStyles)

const vendorPath = path.join(rootDir, 'node_modules', 'konva', 'konva.min.js')
const vendorVersion = fingerprint(await readFile(vendorPath))
const sourceHtml = await readFile(path.join(sourceWebDir, 'index.html'), 'utf8')
const htmlReplacements: Array<readonly [string, string]> = [
  ['./editor/styles.css', `./editor/styles.css?v=${stylesVersion}`],
  ['./vendor/konva.min.js', `./vendor/konva.min.js?v=${vendorVersion}`],
  ['./editor/app.js', `./editor/app.js?v=${webVersion}`],
]
const builtHtml = htmlReplacements.reduce(
  (html, [search, replacement]) => replaceRequired(html, search, replacement),
  sourceHtml,
)
await writeFile(path.join(distWebDir, 'index.html'), builtHtml)

const manifest: WebAssetManifest = {
  format: 'node-zsb-web-assets',
  version: 1,
  webVersion,
  stylesVersion,
  vendorVersion,
  assets: assetVersions,
}
await writeFile(
  path.join(distDir, 'asset-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)

async function buildDirectory(sourceDir: string, outputDir: string): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true })
  await mkdir(outputDir, { recursive: true })
  await Promise.all(entries.map(async (entry) => {
    const sourcePath = path.join(sourceDir, entry.name)
    const outputPath = path.join(outputDir, entry.name)
    if (entry.isDirectory()) {
      await buildDirectory(sourcePath, outputPath)
      return
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return
    const source = await readFile(sourcePath, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        verbatimModuleSyntax: true,
      },
      fileName: sourcePath,
    }).outputText
    await writeFile(outputPath.replace(/\.ts$/, '.js'), output)
  }))
}

async function collectAssetVersions(): Promise<Record<string, string>> {
  const files = (await listFiles(sourceAssetsDir))
    .filter((filePath) => ['.webp', '.woff2'].includes(path.extname(filePath)))
    .sort()
  const versions: Record<string, string> = {}
  for (const filePath of files) {
    const relativePath = path.relative(sourceAssetsDir, filePath).replaceAll('\\', '/')
    versions[`/assets/${relativePath}`] = fingerprint(await readFile(filePath))
  }
  return versions
}

async function fingerprintJavaScript(): Promise<string> {
  const files = [
    ...await listFiles(distWebDir, '.js'),
    ...await listFiles(distSharedDir, '.js'),
  ].sort()
  const hash = createHash('sha256')
  for (const filePath of files) {
    hash.update(path.relative(distDir, filePath).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(filePath))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

async function rewriteJavaScriptImports(directory: string, version: string): Promise<void> {
  const files = await listFiles(directory, '.js')
  await Promise.all(files.map(async (filePath) => {
    const source = await readFile(filePath, 'utf8')
    const output = source.replace(
      /((?:from\s+|import\s*)['"])(\.\.?\/[^'"]+\.js)(['"])/g,
      `$1$2?v=${version}$3`,
    )
    await writeFile(filePath, output)
  }))
}

async function listFiles(directory: string, extension?: string): Promise<string[]> {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name))
  const files: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath, extension))
    } else if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
      files.push(entryPath)
    }
  }
  return files
}

function fingerprint(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16)
}

function replaceRequired(source: string, search: string, replacement: string): string {
  if (!source.includes(search)) throw new Error(`Missing build placeholder: ${search}`)
  return source.replace(search, replacement)
}
