import { startEditorApp } from './editorApp.js'

startEditorApp().catch((error) => {
  console.error(error)
  alert(error.message)
})
