export async function getEditorData() {
  return getJson('/editor-data')
}

export async function decodeBoardCode(code) {
  const payload = await postJson('/utils/code2json', { code })
  return payload.data
}

export async function encodeBoardCode(board, key = 14) {
  const payload = await postJson('/utils/json2code', { board, key })
  return payload.code
}

export async function renderPreviewImage(code) {
  const payload = await postJson('/board/render', { code })
  return payload.data
}

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? '请求失败')
  }
  return payload
}
