import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCurrentProjectSnapshot,
  createEditorDraft,
  detachDocumentAndMarkDirty,
  isDocumentDirty,
  markDocumentClean,
  readEditorDraft,
} from '../../src/web/documentState.ts'
import { createEditorState } from '../../src/web/editorState.ts'
import { createProjectFromBoard } from '../../src/web/project.ts'

test('document state keeps display name, local association, and save baseline separate', () => {
  const state = createEditorState()
  state.board.name = 'Saved board'
  markDocumentClean(state, {
    fileName: 'Saved file',
    associatedLocalFileName: 'Saved file',
  })

  assert.equal(isDocumentDirty(state), false)
  state.currentFileName = 'Save as file'
  assert.equal(isDocumentDirty(state), true)
  assert.equal(state.associatedLocalFileName, 'Saved file')

  markDocumentClean(state, {
    fileName: 'Save as file',
    associatedLocalFileName: 'Save as file',
  })
  assert.equal(isDocumentDirty(state), false)

  detachDocumentAndMarkDirty(state)
  assert.equal(state.currentFileName, 'Save as file')
  assert.equal(state.associatedLocalFileName, '')
  assert.equal(isDocumentDirty(state), true)
})

test('editor drafts preserve association and baseline while supporting legacy project drafts', () => {
  const state = createEditorState()
  state.board.name = 'Draft board'
  markDocumentClean(state, {
    fileName: 'Draft file',
    associatedLocalFileName: 'Draft file',
  })
  const baseline = createCurrentProjectSnapshot(state)
  state.board.name = 'Changed draft'

  const restored = readEditorDraft(createEditorDraft(state))
  assert.ok(restored)
  assert.equal(restored.legacy, false)
  assert.equal(restored.associatedLocalFileName, 'Draft file')
  assert.equal(restored.documentBaselineSnapshot, baseline)
  assert.equal(restored.project.board.name, 'Changed draft')

  const legacyProject = createProjectFromBoard({
    name: 'Legacy draft',
    objects: [],
  }, { fileName: 'Legacy file' })
  const legacy = readEditorDraft(legacyProject)
  assert.ok(legacy)
  assert.equal(legacy.legacy, true)
  assert.equal(legacy.associatedLocalFileName, 'Legacy file')
})
