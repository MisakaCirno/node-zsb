import type {
  Board,
  EditorData,
} from './types.js'

declare function fetch(url: string, init?: FetchInit): Promise<FetchResponse>

interface FetchInit {
  body?: string
  headers?: Record<string, string>
  method?: string
}

interface FetchResponse {
  ok: boolean
  json(): Promise<unknown>
  text(): Promise<string>
}

interface DecodeBoardPayload {
  data: Partial<Board>
}

interface EncodeBoardPayload {
  code: string
}

interface RenderPreviewPayload {
  data: unknown
}

interface ApiErrorPayload {
  ok?: boolean
  error?: string
}

export async function getEditorData(): Promise<EditorData> {
  return getJson<EditorData>('/editor-data')
}

export async function decodeBoardCode(code: string): Promise<Partial<Board>> {
  const payload = await postJson<DecodeBoardPayload>('/utils/code2json', { code })
  return payload.data
}

export async function encodeBoardCode(board: Board, key = 14): Promise<string> {
  const payload = await postJson<EncodeBoardPayload>('/utils/json2code', { board, key })
  return payload.code
}

export async function renderPreviewImage(code: string): Promise<unknown> {
  const payload = await postJson<RenderPreviewPayload>('/board/render', { code })
  return payload.data
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json() as T & ApiErrorPayload
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? '请求失败')
  }
  return payload
}
