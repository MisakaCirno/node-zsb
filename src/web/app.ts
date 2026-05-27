import { startEditorApp } from './editorApp.js'

declare function alert(message: string): void

startEditorApp().catch((error: unknown) => {
  console.error(error)
  alert(error instanceof Error ? error.message : String(error))
})
