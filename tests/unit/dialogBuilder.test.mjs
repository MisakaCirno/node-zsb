import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEditorDialog,
  createTextareaField,
  mountDialogOnce,
} from '../../src/web/dialogBuilder.js'

test('createEditorDialog builds the shared dialog shell and close button contract', () => {
  withFakeDocument(() => {
    const body = document.createElement('div')
    const dialog = createEditorDialog({
      id: 'sample-dialog',
      title: '示例弹窗',
      titleId: 'sample-title',
      compact: true,
      closeButtonId: 'close-sample-dialog',
      body: [body],
      actions: [
        {
          id: 'run-action',
          label: '执行',
          type: 'button',
        },
      ],
    })

    assert.equal(dialog.tagName, 'DIALOG')
    assert.equal(dialog.id, 'sample-dialog')
    assert.equal(dialog.className, 'editor-dialog compact-dialog')

    const [form] = dialog.children
    assert.equal(form.tagName, 'FORM')
    assert.equal(form.method, 'dialog')
    assert.equal(form.className, 'dialog-panel')

    const [header, content, footer] = form.children
    assert.equal(header.className, 'dialog-header')
    assert.equal(header.children[0].tagName, 'H2')
    assert.equal(header.children[0].id, 'sample-title')
    assert.equal(header.children[0].textContent, '示例弹窗')
    assert.equal(header.children[1].id, 'close-sample-dialog')
    assert.equal(header.children[1].type, 'submit')
    assert.equal(header.children[1].value, 'cancel')
    assert.equal(header.children[1].attributes['aria-label'], '关闭')

    assert.equal(content, body)
    assert.equal(footer.className, 'dialog-actions')
    assert.equal(footer.children[0].id, 'run-action')
    assert.equal(footer.children[0].type, 'button')
    assert.equal(footer.children[0].textContent, '执行')
  })
})

test('createEditorDialog defaults action buttons to submit', () => {
  withFakeDocument(() => {
    const dialog = createEditorDialog({
      id: 'submit-dialog',
      title: '提交弹窗',
      body: [],
      actions: [
        {
          id: 'confirm-submit',
          label: '确定',
          value: 'confirm',
        },
      ],
    })

    const footer = dialog.children[0].children[1]
    const button = footer.children[0]
    assert.equal(button.type, 'submit')
    assert.equal(button.value, 'confirm')
  })
})

test('createTextareaField preserves readonly and spellcheck contracts', () => {
  withFakeDocument(() => {
    const field = createTextareaField({
      id: 'code-output',
      label: '分享码',
      readonly: true,
    })

    assert.equal(field.tagName, 'LABEL')
    assert.equal(field.className, 'field')
    assert.equal(field.children[0].tagName, 'SPAN')
    assert.equal(field.children[0].textContent, '分享码')
    assert.equal(field.children[1].tagName, 'TEXTAREA')
    assert.equal(field.children[1].id, 'code-output')
    assert.equal(field.children[1].readOnly, true)
    assert.equal(field.children[1].spellcheck, false)
  })
})

test('mountDialogOnce appends a dialog only when the id is not already mounted', () => {
  withFakeDocument(() => {
    const first = document.createElement('dialog')
    first.id = 'unique-dialog'
    const duplicate = document.createElement('dialog')
    duplicate.id = 'unique-dialog'

    mountDialogOnce(document.body, first)
    mountDialogOnce(document.body, duplicate)

    assert.equal(document.body.children.length, 1)
    assert.equal(document.body.children[0], first)
  })
})

function withFakeDocument(callback) {
  const previousDocument = globalThis.document
  globalThis.document = createFakeDocument()
  try {
    callback()
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = previousDocument
    }
  }
}

function createFakeDocument() {
  const body = createFakeElement('body')
  return {
    body,
    createElement: createFakeElement,
    getElementById(id) {
      return findById(body, id)
    },
    querySelector(selector) {
      return selector === 'body' ? body : null
    },
  }
}

function createFakeElement(tagName) {
  return {
    attributes: {},
    children: [],
    className: '',
    disabled: false,
    id: '',
    method: '',
    parentElement: null,
    readOnly: false,
    spellcheck: true,
    tagName: tagName.toUpperCase(),
    textContent: '',
    type: '',
    value: '',
    append(...nodes) {
      for (const node of nodes) {
        node.parentElement = this
        this.children.push(node)
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value)
    },
  }
}

function findById(element, id) {
  if (element.id === id) {
    return element
  }
  for (const child of element.children) {
    const found = findById(child, id)
    if (found) return found
  }
  return null
}
