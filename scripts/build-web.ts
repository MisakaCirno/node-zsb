import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceWebDir = path.join(rootDir, 'src', 'web')
const sourceSharedDir = path.join(rootDir, 'src', 'shared')
const distWebDir = path.join(rootDir, 'dist', 'web')
const distSharedDir = path.join(rootDir, 'dist', 'shared')

await Promise.all([
  rm(distWebDir, { force: true, recursive: true }),
  rm(distSharedDir, { force: true, recursive: true }),
])

await Promise.all([
  buildDirectory(sourceWebDir, distWebDir),
  buildDirectory(sourceSharedDir, distSharedDir),
])

await Promise.all([
  copyFile(path.join(sourceWebDir, 'index.html'), path.join(distWebDir, 'index.html')),
  copyFile(path.join(sourceWebDir, 'styles.css'), path.join(distWebDir, 'styles.css')),
])

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
