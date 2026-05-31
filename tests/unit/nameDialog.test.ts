import assert from 'node:assert/strict'
import test from 'node:test'

import { createNameDialogController } from '../../src/web/nameDialog.js'

test('createNameDialogController validates input and resolves confirmed names', async () => {
  const form = createFakeForm()
  const dialog = createFakeDialog(form)
  const input = createFakeInput()
  const error = { textContent: null }
  const title = { textContent: null }
  const controller = createNameDialogController({
    elements: {
      dialog,
      input,
      error,
      title,
    },
  })

  const request = controller.requestName({
    currentName: '  初始名称  ',
    title: '保存名称',
    validate: (name) => name ? '' : '请输入名称',
  })

  assert.equal(dialog.showModalCount, 1)
  assert.equal(title.textContent, '保存名称')
  assert.equal(input.value, '  初始名称  ')
  assert.equal(input.focusCount, 1)
  assert.equal(input.selectCount, 1)

  input.value = '   '
  input.dispatchInput()
  assert.equal(error.textContent, '请输入名称')
  assert.equal(input.attributes['aria-invalid'], 'true')

  let prevented = false
  form.dispatchSubmit({
    preventDefault: () => {
      prevented = true
    },
    submitter: { value: 'confirm' },
  })
  assert.equal(prevented, true)

  input.value = '  新名称  '
  input.dispatchInput()
  assert.equal(error.textContent, '')
  assert.equal(input.attributes['aria-invalid'], 'false')

  dialog.returnValue = 'confirm'
  dialog.dispatchClose()
  assert.equal(await request, '新名称')
  assert.equal(error.textContent, '')
})

test('createNameDialogController resolves an empty name when cancelled', async () => {
  const form = createFakeForm()
  const dialog = createFakeDialog(form)
  const input = createFakeInput()
  const controller = createNameDialogController({
    elements: {
      dialog,
      input,
      error: { textContent: null },
    },
  })

  const request = controller.requestName({
    currentName: '草稿',
    validate: () => '不应该在取消时拦截',
  })
  form.dispatchSubmit({
    preventDefault: () => {
      throw new Error('Cancel submit should not be prevented')
    },
    submitter: { value: 'cancel' },
  })
  dialog.returnValue = 'cancel'
  dialog.dispatchClose()

  assert.equal(await request, '')
})

function createFakeDialog(form) {
  const listeners = new Map()
  return {
    returnValue: '',
    showModalCount: 0,
    showModal() {
      this.showModalCount += 1
    },
    querySelector(selector) {
      return selector === 'form' ? form : null
    },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    dispatchClose() {
      listeners.get('close')?.()
    },
  }
}

function createFakeForm() {
  let submitListener = null
  return {
    addEventListener(type, listener) {
      if (type === 'submit') {
        submitListener = listener
      }
    },
    dispatchSubmit(event) {
      submitListener?.(event)
    },
  }
}

function createFakeInput() {
  const listeners = new Map()
  return {
    attributes: {},
    focusCount: 0,
    selectCount: 0,
    value: '',
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    dispatchInput() {
      listeners.get('input')?.()
    },
    focus() {
      this.focusCount += 1
    },
    select() {
      this.selectCount += 1
    },
    setAttribute(name, value) {
      this.attributes[name] = value
    },
  }
}
